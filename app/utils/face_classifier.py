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
    Cluster unknown captured images in media/unknown/ and media/captures/
    including spoof, unknown strangers, no-face, and unassigned scans using DBSCAN
    and ArcFace embeddings from the unified embedding engine.
    """
    valid_extensions = ('.jpg', '.jpeg', '.png')
    search_dirs = [
        ('unknown', os.path.join(settings.MEDIA_ROOT, 'unknown')),
        ('captures', os.path.join(settings.MEDIA_ROOT, 'captures')),
    ]

    # Find any scan_ files that belong to APPROVED recognized persons so we don't accidentally cluster them
    approved_scan_files = set(
        RecognitionLog.objects.filter(status='APPROVED', person_name__isnull=False)
        .exclude(person_name='')
        .values_list('image_path', flat=True)
    )
    approved_basenames = {os.path.basename(p) for p in approved_scan_files if p}

    all_file_items = []
    for rel_folder, abs_dir in search_dirs:
        if os.path.exists(abs_dir):
            for f in os.listdir(abs_dir):
                if f.lower().endswith(valid_extensions):
                    # Skip approved recognized scans
                    if f in approved_basenames:
                        continue
                    all_file_items.append((rel_folder, f, os.path.join(abs_dir, f)))

    if not all_file_items:
        return []

    embeddings = {}
    file_map = {}
    no_face_images = []

    for rel_folder, filename, img_path in all_file_items:
        key = f"{rel_folder}/{filename}"
        f_lower = filename.lower()
        if 'spoof' in f_lower:
            cat = 'spoof'
        elif 'noface' in f_lower:
            cat = 'noface'
        elif 'unknown' in f_lower:
            cat = 'unknown'
        else:
            cat = 'scan'

        file_map[key] = {
            'filename': filename, 
            'rel_folder': rel_folder, 
            'url': f"{settings.MEDIA_URL}{rel_folder}/{filename}",
            'category': cat
        }
        try:
            result = compute_embedding(img_path)
            if result is not None:
                emb, conf, _ = result
                embeddings[key] = np.array(emb, dtype=np.float32)
            else:
                no_face_images.append(key)
        except Exception as e:
            logger.error(f"Error computing embedding for {key}: {e}")
            no_face_images.append(key)

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

        for cluster_id, keys in clusters.items():
            groups_list.append({
                'id': f"group_{cluster_id}",
                'images': [file_map[k] for k in keys if k in file_map],
                'count': len(keys),
                'is_cluster': True,
                'is_noface': False
            })

        for idx, k in enumerate(outliers):
            if k in file_map:
                groups_list.append({
                    'id': f"single_{idx}",
                    'images': [file_map[k]],
                    'count': 1,
                    'is_cluster': False,
                    'is_noface': False
                })

    if no_face_images:
        groups_list.append({
            'id': 'noface',
            'images': [file_map[k] for k in no_face_images if k in file_map],
            'count': len(no_face_images),
            'is_cluster': False,
            'is_noface': True
        })

    return groups_list


def assign_person(group_images, person_name, category='STUDENT', class_name='', department=''):
    """
    Assign a group of unknown images to a known or new person.
    Moves files from media/unknown/ or media/captures/
    to media/dataset/<person_name>/.
    """
    if not group_images or not person_name.strip():
        return False, "Invalid parameters."

    person_name = person_name.strip()
    unknown_dir = os.path.join(settings.MEDIA_ROOT, 'unknown')
    captures_dir = os.path.join(settings.MEDIA_ROOT, 'captures')

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
                # Find source file in unknown or captures directory
                src_path = os.path.join(unknown_dir, filename)
                if not os.path.exists(src_path):
                    src_path = os.path.join(captures_dir, filename)
                if not os.path.exists(src_path):
                    # Also try if filename itself contains rel path
                    src_path = os.path.join(settings.MEDIA_ROOT, filename)
                if not os.path.exists(src_path):
                    continue

                actual_filename = os.path.basename(filename)
                base_name, ext = os.path.splitext(actual_filename)
                target_filename = actual_filename
                target_path = os.path.join(dataset_dir, target_filename)

                counter = 1
                while os.path.exists(target_path):
                    target_filename = f"{base_name}_{counter}{ext}"
                    target_path = os.path.join(dataset_dir, target_filename)
                    counter += 1

                shutil.move(src_path, target_path)

                relative_image_path = f"dataset/{person_name}/{target_filename}"
                PersonImage.objects.create(person=person, image=relative_image_path)

                # Instantly compute embedding and register in FaceGallery for access control
                try:
                    from app.utils.embedding_engine import get_gallery
                    emb_res = compute_embedding(target_path)
                    if emb_res is not None:
                        emb, _, _ = emb_res
                        get_gallery().add_embedding(person.id, person.name, emb)
                except Exception as emb_err:
                    logger.warning(f"Could not compute embedding for newly assigned image: {emb_err}")

                RecognitionLog.objects.filter(image_path__icontains=actual_filename).delete()

        return True, f"Successfully assigned {len(group_images)} images to '{person_name}'."

    except Exception as e:
        logger.error(f"Error assigning group: {e}")
        return False, f"Failed: {str(e)}"
