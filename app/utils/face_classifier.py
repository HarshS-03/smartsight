import os
import shutil
import logging
import cv2
import numpy as np
from collections import defaultdict
from sklearn.cluster import DBSCAN
from django.conf import settings
from django.db import transaction
from app.models import Person, PersonImage, RecognitionLog
from app.utils.embedding_engine import compute_embedding

logger = logging.getLogger(__name__)


def cluster_faces():
    """
    Cluster unknown captured images in media/unknown/ using DBSCAN
    and ArcFace embeddings from the unified embedding engine.
    No separate cache files needed.
    """
    unknown_dir = os.path.join(settings.MEDIA_ROOT, 'unknown')
    os.makedirs(unknown_dir, exist_ok=True)

    valid_extensions = ('.jpg', '.jpeg', '.png')
    all_files = os.listdir(unknown_dir)
    image_filenames = [f for f in all_files if f.lower().endswith(valid_extensions)]

    if not image_filenames:
        return []

    embeddings = {}
    no_face_images = []

    for filename in image_filenames:
        img_path = os.path.join(unknown_dir, filename)
        try:
            result = compute_embedding(img_path)
            if result is not None:
                emb, conf, _ = result
                embeddings[filename] = np.array(emb, dtype=np.float32)
            else:
                no_face_images.append(filename)
        except Exception as e:
            logger.error(f"Error computing embedding for {filename}: {e}")
            no_face_images.append(filename)

    groups_list = []

    if embeddings:
        filenames_with_embeddings = list(embeddings.keys())
        embeddings_matrix = np.array([embeddings[f] for f in filenames_with_embeddings], dtype=np.float32)

        labels = np.array([-1] * len(embeddings_matrix))
        if len(embeddings_matrix) >= 2:
            try:
                db = DBSCAN(eps=0.42, min_samples=2, metric='cosine')
                labels = db.fit_predict(embeddings_matrix)
            except Exception as e:
                logger.error(f"DBSCAN clustering failed: {e}")

        clusters = defaultdict(list)
        outliers = []

        for idx, label in enumerate(labels):
            filename = filenames_with_embeddings[idx]
            if label != -1:
                clusters[int(label)].append(filename)
            else:
                outliers.append(filename)

        for cluster_id, files in clusters.items():
            groups_list.append({
                'id': f"group_{cluster_id}",
                'images': [{'filename': f, 'url': f"{settings.MEDIA_URL}unknown/{f}"} for f in files],
                'count': len(files),
                'is_cluster': True,
                'is_noface': False
            })

        for idx, f in enumerate(outliers):
            groups_list.append({
                'id': f"single_{idx}",
                'images': [{'filename': f, 'url': f"{settings.MEDIA_URL}unknown/{f}"}],
                'count': 1,
                'is_cluster': False,
                'is_noface': False
            })

    if no_face_images:
        groups_list.append({
            'id': 'noface',
            'images': [{'filename': f, 'url': f"{settings.MEDIA_URL}unknown/{f}"} for f in no_face_images],
            'count': len(no_face_images),
            'is_cluster': False,
            'is_noface': True
        })

    return groups_list


def assign_person(group_images, person_name, category='STUDENT', class_name='', department=''):
    """
    Assign a group of unknown images to a known or new person.
    Moves files from media/unknown/
    to media/dataset/<person_name>/.
    """
    if not group_images or not person_name.strip():
        return False, "Invalid parameters."

    person_name = person_name.strip()
    unknown_dir = os.path.join(settings.MEDIA_ROOT, 'unknown')

    try:
        with transaction.atomic():
            person = Person.objects.filter(name__iexact=person_name).first()
            if not person:
                person = Person.objects.create(
                    name=person_name,
                    category=category,
                    class_name=class_name if category == 'STUDENT' else '',
                    department=department if category != 'STUDENT' else ''
                )
            else:
                if category:
                    person.category = category
                if class_name and category == 'STUDENT':
                    person.class_name = class_name
                if department and category != 'STUDENT':
                    person.department = department
                person.save()

            person_name = person.name
            dataset_dir = os.path.join(settings.MEDIA_ROOT, 'dataset', person_name)
            os.makedirs(dataset_dir, exist_ok=True)

            for filename in group_images:
                src_path = os.path.join(unknown_dir, filename)
                if not os.path.exists(src_path):
                    continue

                base_name, ext = os.path.splitext(filename)
                target_filename = filename
                target_path = os.path.join(dataset_dir, target_filename)

                counter = 1
                while os.path.exists(target_path):
                    target_filename = f"{base_name}_{counter}{ext}"
                    target_path = os.path.join(dataset_dir, target_filename)
                    counter += 1

                shutil.move(src_path, target_path)

                relative_image_path = f"dataset/{person_name}/{target_filename}"
                PersonImage.objects.create(person=person, image=relative_image_path)

                RecognitionLog.objects.filter(image_path__icontains=filename).delete()

        return True, f"Successfully assigned {len(group_images)} images to '{person_name}'."

    except Exception as e:
        logger.error(f"Error assigning group: {e}")
        return False, f"Failed: {str(e)}"
