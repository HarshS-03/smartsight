import os
import json
import shutil
import logging
import cv2
import numpy as np
from collections import defaultdict
from sklearn.cluster import DBSCAN
from deepface import DeepFace
from django.conf import settings
from django.db import transaction
from app.models import Person, PersonImage, RecognitionLog

# Suppress TensorFlow logging warnings
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'

logger = logging.getLogger(__name__)

CACHE_FILE_NAME = '.embedding_cache.json'
CACHE_VERSION = 3


def get_cache_path():
    return os.path.join(settings.MEDIA_ROOT, 'unknown', CACHE_FILE_NAME)


def load_cache():
    cache_path = get_cache_path()
    if os.path.exists(cache_path):
        try:
            with open(cache_path, 'r') as f:
                data = json.load(f)
            if data.get('_cache_version') == CACHE_VERSION:
                return data
        except Exception as e:
            logger.error(f"Error loading cache: {e}")
    return {'_cache_version': CACHE_VERSION}


def save_cache(cache):
    cache_path = get_cache_path()
    try:
        os.makedirs(os.path.dirname(cache_path), exist_ok=True)
        with open(cache_path, 'w') as f:
            json.dump(cache, f, indent=4)
    except Exception as e:
        logger.error(f"Error saving cache: {e}")


def cluster_faces():
    unknown_dir = os.path.join(settings.MEDIA_ROOT, 'unknown')
    os.makedirs(unknown_dir, exist_ok=True)
    
    valid_extensions = ('.jpg', '.jpeg', '.png')
    all_files = os.listdir(unknown_dir)
    image_filenames = [f for f in all_files if f.lower().endswith(valid_extensions)]
    
    if not image_filenames:
        return []
        
    cache = load_cache()
    embeddings = {}
    no_face_images = []
    cache_updated = False
    
    for filename in image_filenames:
        img_path = os.path.join(unknown_dir, filename)
        
        if filename in cache and filename != '_cache_version':
            val = cache[filename]
            if val == "NO_FACE" or val is None:
                no_face_images.append(filename)
            else:
                embeddings[filename] = val
            continue
            
        try:
            img = cv2.imread(img_path)
            if img is None:
                continue
            
            # Use RetinaFace for detection + ArcFace for embedding (via DeepFace)
            res = DeepFace.represent(
                img_path=img,
                model_name='ArcFace',
                enforce_detection=False,
                detector_backend='retinaface',
                align=True
            )
            
            if res and 'embedding' in res[0]:
                emb = res[0]['embedding']
                embeddings[filename] = emb
                cache[filename] = emb
            else:
                no_face_images.append(filename)
                cache[filename] = "NO_FACE"
                
        except Exception as e:
            logger.error(f"Error processing {filename}: {e}")
            no_face_images.append(filename)
            cache[filename] = "NO_FACE"
        
        cache_updated = True
        
    if cache_updated:
        save_cache(cache)
        
    groups_list = []
    
    if embeddings:
        filenames_with_embeddings = list(embeddings.keys())
        embeddings_matrix = np.array([embeddings[f] for f in filenames_with_embeddings])
        
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


def assign_person(group_images, person_name):
    if not group_images or not person_name.strip():
        return False, "Invalid parameters."
        
    person_name = person_name.strip()
    unknown_dir = os.path.join(settings.MEDIA_ROOT, 'unknown')
    cache = load_cache()
    cache_updated = False
    
    try:
        with transaction.atomic():
            person = Person.objects.filter(name__iexact=person_name).first()
            if not person:
                person = Person.objects.create(name=person_name)
            
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
                
                if filename in cache:
                    del cache[filename]
                    cache_updated = True
                    
        if cache_updated:
            save_cache(cache)
            
        return True, f"Successfully assigned {len(group_images)} images to '{person_name}'."
        
    except Exception as e:
        logger.error(f"Error assigning group: {e}")
        return False, f"Failed: {str(e)}"
