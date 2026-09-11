import os
import threading
import logging
import numpy as np
import cv2 as cv
from django.conf import settings

logger = logging.getLogger(__name__)

# Suppress TensorFlow noise
import warnings
warnings.filterwarnings('ignore')
os.environ.setdefault('TF_CPP_MIN_LOG_LEVEL', '3')
os.environ.setdefault('TF_ENABLE_ONEDNN_OPTS', '0')
os.environ.setdefault('AUTOGRAPH_VERBOSITY', '0')

# ---------------------------------------------------------------------------
# Lazy model loading
# ---------------------------------------------------------------------------
_models_lock = threading.Lock()
_face_detector_models = {}
_arcface_model = None


def _get_face_detector(model_name=None):
    """Lazy-load YOLO Face detector."""
    global _face_detector_models
    
    # Resolve the physical model path
    if model_name in ['yolo26n_face_onnx', 'yolo26n-face.onnx']:
        model_path = 'app/models/yolo26n-face.onnx'
    elif model_name in ['yolo26n_face_pt', 'yolo26n-face.pt']:
        model_path = 'app/models/yolo26n-face.pt'
    elif model_name in ['yolov8n_face_onnx', 'yolov8n-face.onnx', 'face']:
        model_path = 'app/models/yolov8n-face.onnx'
    elif model_name in ['yolov8n_face_pt', 'yolov8n-face.pt']:
        model_path = 'app/models/yolov8n-face.pt'
    else:
        model_path = getattr(settings, 'FACE_DETECTION_MODEL', 'app/models/yolo26n-face.onnx')
        
    if not os.path.exists(model_path):
        if os.path.exists('yolo26n-face.onnx'):
            model_path = 'yolo26n-face.onnx'
        elif os.path.exists('yolov8n-face.onnx'):
            model_path = 'yolov8n-face.onnx'
        else:
            model_path = 'app/models/nano/weights/best.onnx'
            
    cache_key = model_path
    
    if cache_key not in _face_detector_models:
        with _models_lock:
            if cache_key not in _face_detector_models:
                try:
                    from ultralytics.utils import LOGGER as ULTRALYTICS_LOGGER
                    ULTRALYTICS_LOGGER.setLevel(logging.ERROR)
                except Exception:
                    pass
                from ultralytics import YOLO
                try:
                    _face_detector_models[cache_key] = YOLO(model_path, task='detect', verbose=False)
                except Exception as load_err:
                    logger.warning(f"[EmbeddingEngine] Failed to load detector {model_path}: {load_err}. Falling back to stable models...")
                    fallback_paths = [
                        model_path.replace('.onnx', '.pt'),
                        'app/models/yolo26n-face.pt',
                        'app/models/yolov8n-face.onnx',
                        'app/models/yolov8n-face.pt',
                        'app/models/nano/weights/best.onnx',
                    ]
                    loaded = False
                    for fb in fallback_paths:
                        if os.path.exists(fb):
                            try:
                                _face_detector_models[cache_key] = YOLO(fb, task='detect', verbose=False)
                                logger.info(f"[EmbeddingEngine] Successfully loaded fallback detector: {fb}")
                                loaded = True
                                break
                            except Exception:
                                continue
                    if not loaded:
                        raise load_err
    return _face_detector_models[cache_key]


def _get_arcface():
    """Lazy-load ArcFace recognition model."""
    global _arcface_model
    if _arcface_model is None:
        with _models_lock:
            if _arcface_model is None:
                try:
                    import tensorflow as tf
                    tf.get_logger().setLevel(logging.ERROR)
                    if hasattr(tf, 'compat') and hasattr(tf.compat, 'v1') and hasattr(tf.compat.v1, 'logging'):
                        tf.compat.v1.logging.set_verbosity(tf.compat.v1.logging.ERROR)
                except Exception:
                    pass
                try:
                    from deepface.modules import modeling
                    _arcface_model = modeling.build_model(task='facial_recognition', model_name='ArcFace')
                except Exception:
                    from deepface import DeepFace
                    dummy = np.zeros((112, 112, 3), dtype=np.uint8)
                    try:
                        DeepFace.represent(
                            img_path=dummy,
                            model_name='ArcFace',
                            detector_backend='skip',
                            enforce_detection=False,
                            align=False,
                        )
                    except Exception:
                        pass
                    from deepface.modules import modeling
                    try:
                        _arcface_model = modeling.build_model(task='facial_recognition', model_name='ArcFace')
                    except Exception:
                        _arcface_model = True
                # logger.info("[EmbeddingEngine] ArcFace model ready.")
    return _arcface_model


# ============================================================================
# Embedding Gallery — in-memory vectorized store for real-time matching
# ============================================================================

class EmbeddingGallery:
    """
    In-memory gallery of known person embeddings for sub-millisecond cosine
    similarity matching. Backed by the ``PersonEmbedding`` DB table.
    Uses vectorized NumPy matrix operations for ultra-fast matching.
    """

    def __init__(self):
        self._lock = threading.RLock()
        # {person_id: [(embedding_np_array, person_name), ...]}
        self._gallery: dict[int, list[tuple[np.ndarray, str]]] = {}
        self._matrix: np.ndarray | None = None
        self._meta: list[tuple[str, int]] = []  # [(person_name, person_id), ...]
        self._person_info: dict[int, dict] = {}  # {person_id: {'name': str, 'class_name': str, 'department': str, 'category': str}}
        self._loaded = False
        
        self.cache_dir = os.path.join(settings.MEDIA_ROOT, 'cache')
        os.makedirs(self.cache_dir, exist_ok=True)
        self.cache_file = os.path.join(self.cache_dir, 'gallery_embeddings.npz')

    def _rebuild_matrix(self):
        vectors = []
        meta = []
        for pid, entries in self._gallery.items():
            for (emb, name) in entries:
                vectors.append(emb)
                meta.append((name, pid))
        if vectors:
            self._matrix = np.vstack(vectors).astype(np.float32)
            self._meta = meta
        else:
            self._matrix = None
            self._meta = []

    def _save_cache(self, count):
        """Save current matrix and metadata to disk."""
        if self._matrix is not None:
            names = np.array([m[0] for m in self._meta])
            pids = np.array([m[1] for m in self._meta])
            np.savez_compressed(self.cache_file, matrix=self._matrix, names=names, pids=pids, count=count)

    def _refresh_person_info(self):
        """Cache person metadata (class_name, department, category) for fast labeling."""
        try:
            from app.models import Person
            with self._lock:
                self._person_info = {
                    p.id: {
                        'name': p.name,
                        'category': p.category,
                        'class_name': p.class_name or '',
                        'department': p.department or '',
                    }
                    for p in Person.objects.all()
                }
        except Exception:
            pass

    def get_person_info(self, person_id=None, person_name=None) -> dict:
        """Retrieve person metadata with on-demand DB fetch fallback."""
        if person_id is not None:
            try:
                person_id = int(person_id)
            except (ValueError, TypeError):
                pass
            with self._lock:
                if person_id in self._person_info:
                    return self._person_info[person_id]

        try:
            from app.models import Person
            p = None
            if person_id is not None:
                p = Person.objects.filter(id=person_id).first()
            if not p and person_name:
                p = Person.objects.filter(name__iexact=str(person_name).strip()).first()
            
            if p:
                info = {
                    'name': p.name,
                    'category': p.category,
                    'class_name': p.class_name or '',
                    'department': p.department or '',
                }
                with self._lock:
                    self._person_info[p.id] = info
                return info
        except Exception:
            pass
        return {}

    # ------------------------------------------------------------------
    # Load / Reload
    # ------------------------------------------------------------------
    def load_gallery(self):
        """Load from NPZ cache if valid, else from DB."""
        from app.models import PersonEmbedding
        self._refresh_person_info()
        with self._lock:
            try:
                db_count = PersonEmbedding.objects.count()
            except Exception:
                db_count = 0
            
            # Try to load from cache
            if os.path.exists(self.cache_file):
                try:
                    data = np.load(self.cache_file, allow_pickle=True)
                    if data['count'] == db_count:
                        self._matrix = data['matrix']
                        self._meta = list(zip(data['names'], data['pids']))
                        self._gallery.clear()
                        for (name, pid), emb in zip(self._meta, self._matrix):
                            self._gallery.setdefault(pid, []).append((emb, name))
                        self._loaded = True
                        logger.info(f"[Gallery] Loaded {db_count} embeddings instantly from cache.")
                        return
                except Exception as e:
                    logger.warning(f"[Gallery] Failed to load cache: {e}. Rebuilding...")

            # Fallback to DB
            self._gallery.clear()
            count = 0
            for pe in PersonEmbedding.objects.select_related('person').all():
                pid = pe.person_id
                name = pe.person.name
                emb = np.array(pe.embedding, dtype=np.float32)
                # L2-normalise for cosine similarity via dot product
                norm = np.linalg.norm(emb)
                if norm > 0:
                    emb = emb / norm
                self._gallery.setdefault(pid, []).append((emb, name))
                count += 1
            self._rebuild_matrix()
            self._save_cache(db_count)
            self._loaded = True
            logger.info(f"[Gallery] Loaded {count} embeddings from DB and rebuilt cache.")

    def reload(self):
        """Force full reload from DB."""
        if os.path.exists(self.cache_file):
            try:
                os.remove(self.cache_file)
            except Exception:
                pass
        self.load_gallery()

    def ensure_loaded(self):
        """Load gallery on first access (lazy init)."""
        if not self._loaded:
            self.load_gallery()

    # ------------------------------------------------------------------
    # Hot-update (no restart needed)
    # ------------------------------------------------------------------
    def add_embedding(self, person_id: int, person_name: str, embedding):
        """Add a single embedding to the in-memory gallery (instant, no restart)."""
        emb = np.array(embedding, dtype=np.float32)
        norm = np.linalg.norm(emb)
        if norm > 0:
            emb = emb / norm
        with self._lock:
            self._gallery.setdefault(person_id, []).append((emb, person_name))
            self._rebuild_matrix()
            from app.models import PersonEmbedding
            self._save_cache(PersonEmbedding.objects.count())

    def remove_person(self, person_id: int):
        """Remove all embeddings for a person from in-memory gallery."""
        with self._lock:
            self._gallery.pop(person_id, None)
            self._rebuild_matrix()
            from app.models import PersonEmbedding
            self._save_cache(PersonEmbedding.objects.count())

    def remove_embedding_by_source(self, person_id: int, source_image_id: int):
        """Remove embeddings sourced from a specific PersonImage."""
        from app.models import PersonEmbedding
        with self._lock:
            entries = []
            for pe in PersonEmbedding.objects.filter(person_id=person_id).select_related('person'):
                emb = np.array(pe.embedding, dtype=np.float32)
                norm = np.linalg.norm(emb)
                if norm > 0:
                    emb = emb / norm
                entries.append((emb, pe.person.name))
            if entries:
                self._gallery[person_id] = entries
            else:
                self._gallery.pop(person_id, None)
            self._rebuild_matrix()
            self._save_cache(PersonEmbedding.objects.count())

    def update_person_meta(self, person_id: int, new_name: str = None, category: str = None, class_name: str = None, department: str = None):
        """Update a person's name and metadata across in-memory structures and disk cache."""
        with self._lock:
            if person_id in self._gallery and new_name:
                updated_entries = []
                for emb, _ in self._gallery[person_id]:
                    updated_entries.append((emb, new_name))
                self._gallery[person_id] = updated_entries
                self._rebuild_matrix()
                from app.models import PersonEmbedding
                self._save_cache(PersonEmbedding.objects.count())

            # Update cached metadata
            if person_id in self._person_info:
                if new_name is not None:
                    self._person_info[person_id]['name'] = new_name
                if category is not None:
                    self._person_info[person_id]['category'] = category
                if class_name is not None:
                    self._person_info[person_id]['class_name'] = class_name
                if department is not None:
                    self._person_info[person_id]['department'] = department
            else:
                self._refresh_person_info()

    # ------------------------------------------------------------------
    # Matching
    # ------------------------------------------------------------------
    def match(self, embedding, threshold: float = 0.55):
        """
        Find the closest match in the gallery using vectorized cosine similarity.
        Executes in ~5 microseconds across all known gallery embeddings.

        Returns:
            (person_name, person_id, similarity_score) if match ≥ threshold
            (None, None, best_score) if no match
        """
        self.ensure_loaded()
        emb = np.array(embedding, dtype=np.float32).flatten()
        norm = np.linalg.norm(emb)
        if norm > 0:
            emb = emb / norm

        with self._lock:
            if self._matrix is None or len(self._meta) == 0:
                return None, None, 0.0

            # Single BLAS dot product across entire gallery
            sims = np.dot(self._matrix, emb)
            best_idx = int(np.argmax(sims))
            best_score = float(sims[best_idx])
            best_name, best_pid = self._meta[best_idx]

        if best_score >= threshold:
            return best_name, best_pid, best_score
        return None, None, best_score

    # ------------------------------------------------------------------
    # Stats
    # ------------------------------------------------------------------
    def stats(self):
        """Return gallery statistics."""
        self.ensure_loaded()
        with self._lock:
            total_embeddings = len(self._meta)
            return {
                'total_persons': len(self._gallery),
                'total_embeddings': total_embeddings,
                'loaded': self._loaded,
            }


# ---------------------------------------------------------------------------
# Singleton gallery instance
# ---------------------------------------------------------------------------
_gallery_instance = None
_gallery_init_lock = threading.Lock()


def get_gallery() -> EmbeddingGallery:
    """Return the singleton EmbeddingGallery (created on first call)."""
    global _gallery_instance
    if _gallery_instance is None:
        with _gallery_init_lock:
            if _gallery_instance is None:
                _gallery_instance = EmbeddingGallery()
    return _gallery_instance


# ============================================================================
# Core Functions
# ============================================================================

def embed_face_crop(crop_bgr):
    """
    Compute a 512-d ArcFace embedding from a YOLOv8-Face cropped region.
    Optimized direct model execution bypassing DeepFace wrapper overhead.
    """
    if crop_bgr is None or crop_bgr.size == 0:
        return None

    h, w = crop_bgr.shape[:2]
    if h < 20 or w < 20:
        return None

    try:
        model = _get_arcface()
        # Convert BGR to RGB and resize to (112, 112)
        crop_rgb = cv.cvtColor(crop_bgr, cv.COLOR_BGR2RGB)
        crop_resized = cv.resize(crop_rgb, (112, 112), interpolation=cv.INTER_AREA)
        
        # ArcFace normalization: (pixel - 127.5) / 128.0
        img_input = (crop_resized.astype(np.float32) - 127.5) / 128.0
        img_input = np.expand_dims(img_input, axis=0)

        if hasattr(model, 'predict_on_batch'):
            raw_emb = model.predict_on_batch(img_input)[0]
        elif hasattr(model, '__call__') and not isinstance(model, bool):
            raw_emb = model(img_input, training=False).numpy()[0]
        else:
            from deepface import DeepFace
            res = DeepFace.represent(
                img_path=crop_bgr,
                model_name='ArcFace',
                detector_backend='skip',
                enforce_detection=False,
                align=False,
            )
            return np.array(res[0]['embedding'], dtype=np.float32) if res else None

        emb = np.array(raw_emb, dtype=np.float32).flatten()
        norm = np.linalg.norm(emb)
        if norm > 0:
            emb = emb / norm
        return emb
    except Exception as e:
        logger.debug(f"[EmbeddingEngine] embed_face_crop direct error: {e}")
        try:
            from deepface import DeepFace
            res = DeepFace.represent(
                img_path=crop_bgr,
                model_name='ArcFace',
                detector_backend='skip',
                enforce_detection=False,
                align=False,
            )
            if res and len(res) > 0:
                emb = np.array(res[0]['embedding'], dtype=np.float32)
                norm = np.linalg.norm(emb)
                return emb / norm if norm > 0 else emb
        except Exception:
            pass

    return None


def compute_embedding(image_or_path, model_name=None):
    """
    Compute a 512-d ArcFace embedding for an image using YOLOv8-Face detection.
    Returns: (embedding_512d_np, detection_confidence, aligned_face_bgr) or None
    """
    _get_face_detector(model_name)
    _get_arcface()

    try:
        if isinstance(image_or_path, str):
            img = cv.imread(image_or_path)
            if img is None:
                return None
        else:
            img = image_or_path

        h, w = img.shape[:2]
        detector = _get_face_detector(model_name)
        results = detector(img, conf=0.30, verbose=False)

        if not results or len(results[0].boxes) == 0:
            emb = embed_face_crop(img)
            if emb is not None:
                return (emb, 0.5, img)
            return None

        best_box = None
        best_conf = 0.0
        for b in results[0].boxes:
            conf = float(b.conf[0])
            if conf > best_conf:
                best_conf = conf
                best_box = b

        bx1, by1, bx2, by2 = [int(v) for v in best_box.xyxy[0]]
        x1 = max(0, bx1)
        y1 = max(0, by1)
        x2 = min(w, bx2)
        y2 = min(h, by2)
        face_crop = img[y1:y2, x1:x2].copy()

        embedding = embed_face_crop(face_crop)
        if embedding is not None:
            return (embedding, best_conf, face_crop)

    except Exception as e:
        logger.error(f"[EmbeddingEngine] compute_embedding error: {e}")

    return None


# ---------------------------------------------------------------------------
# Spatial Face Tracker & Recognition Cache (prevents frame freezing)
# ---------------------------------------------------------------------------
_face_tracks = {}
_tracks_lock = threading.Lock()
_track_counter = 0


def _box_iou(b1, b2):
    """Compute Intersection over Union between two (x1, y1, x2, y2) bounding boxes."""
    xA = max(b1[0], b2[0])
    yA = max(b1[1], b2[1])
    xB = min(b1[2], b2[2])
    yB = min(b1[3], b2[3])
    inter = max(0, xB - xA) * max(0, yB - yA)
    area1 = max(1, (b1[2] - b1[0]) * (b1[3] - b1[1]))
    area2 = max(1, (b2[2] - b2[0]) * (b2[3] - b2[1]))
    return inter / float(area1 + area2 - inter)


def detect_and_recognize(frame, threshold=None, max_faces=10, model_name=None):
    """
    High-performance YOLOv8-Face + ArcFace pipeline on a video frame.
    Incorporates spatial face tracking to eliminate redundant neural re-embeddings,
    keeping stream FPS fluid and preventing frame freezing.
    """
    global _track_counter
    import time

    if threshold is None:
        threshold = getattr(settings, 'ARCFACE_SIMILARITY_THRESHOLD', 0.50)

    detector = _get_face_detector(model_name)
    _get_arcface()
    gallery = get_gallery()

    now = time.time()
    results_list = []

    try:
        fh, fw = frame.shape[:2]
        if fw > 640:
            scale_w = 640.0 / fw
            target_h = max(320, int(fh * scale_w))
            infer_frame = cv.resize(frame, (640, target_h), interpolation=cv.INTER_AREA)
            scale_x = fw / 640.0
            scale_y = fh / float(target_h)
        else:
            infer_frame = frame
            scale_x = 1.0
            scale_y = 1.0

        det_conf_thresh = getattr(settings, 'ARCFACE_DETECTION_CONFIDENCE', 0.45)
        results = detector(infer_frame, conf=det_conf_thresh, verbose=False, imgsz=640)
        if not results or len(results[0].boxes) == 0:
            with _tracks_lock:
                _face_tracks.clear()
            return results_list

        boxes = results[0].boxes[:max_faces]

        with _tracks_lock:
            # Clean up old tracks (> 0.8s unseen)
            to_del = [tid for tid, t in _face_tracks.items() if now - t['last_seen'] > 0.8]
            for tid in to_del:
                _face_tracks.pop(tid, None)

            for box in boxes:
                cls_id = int(box.cls[0])
                if cls_id != 0:
                    continue
                det_conf = float(box.conf[0])
                if det_conf < det_conf_thresh:
                    continue
                bx1, by1, bx2, by2 = [float(v) for v in box.xyxy[0]]
                x1 = max(0, int(bx1 * scale_x))
                y1 = max(0, int(by1 * scale_y))
                x2 = min(fw, int(bx2 * scale_x))
                y2 = min(fh, int(by2 * scale_y))

                # Ignore tiny spurious noise regions (< 36x36 px)
                if (x2 - x1) < 36 or (y2 - y1) < 36:
                    continue

                current_bbox = (x1, y1, x2, y2)

                # Match against active tracks
                matched_track_id = None
                best_iou = 0.0
                for tid, track in _face_tracks.items():
                    iou = _box_iou(current_bbox, track['bbox'])
                    if iou > best_iou and iou >= 0.30:
                        best_iou = iou
                        matched_track_id = tid

                # If face is already tracked and re-embedded recently (< 12 frames), reuse identity
                if matched_track_id is not None:
                    track = _face_tracks[matched_track_id]
                    track['bbox'] = current_bbox
                    track['last_seen'] = now
                    track['frames'] += 1

                    if track['frames'] < 12:
                        # Ensure tracked face has class/dept resolved
                        if track['is_known'] and ('[' not in str(track.get('display_name', ''))):
                            p_info = gallery.get_person_info(track.get('person_id'), track.get('person_name'))
                            cls = p_info.get('class_name') or p_info.get('department') or ''
                            if cls:
                                track['class_name'] = cls
                                track['display_name'] = f"{track['person_name']} [{cls}]"

                        # Fast path: instant identity reuse, 0ms neural latency
                        results_list.append({
                            'bbox': current_bbox,
                            'person_name': track['person_name'],
                            'display_name': track.get('display_name') or (track['person_name'] if track['is_known'] else 'Unknown'),
                            'class_name': track.get('class_name', ''),
                            'person_id': track['person_id'],
                            'detection_confidence': det_conf,
                            'recognition_similarity': track['recognition_similarity'],
                            'is_known': track['is_known'],
                            'embedding': track.get('embedding'),
                        })
                        continue
                    else:
                        track['frames'] = 0  # Trigger periodic refresh

                # Compute ArcFace embedding for new or refreshed face
                crop = frame[y1:y2, x1:x2]
                embedding = embed_face_crop(crop)

                person_name, person_id, similarity = None, None, 0.0
                is_known = False
                display_name = 'Unknown'
                class_name = ''
                if embedding is not None:
                    person_name, person_id, similarity = gallery.match(embedding, threshold)
                    is_known = person_name is not None
                    if is_known:
                        p_info = gallery.get_person_info(person_id, person_name)
                        cls = p_info.get('class_name') or p_info.get('department') or ''
                        class_name = cls
                        if cls:
                            display_name = f"{person_name} [{cls}]"
                        else:
                            display_name = person_name

                # Register or update track
                if matched_track_id is None:
                    _track_counter += 1
                    matched_track_id = _track_counter

                _face_tracks[matched_track_id] = {
                    'bbox': current_bbox,
                    'person_name': person_name,
                    'display_name': display_name,
                    'class_name': class_name,
                    'person_id': person_id,
                    'detection_confidence': det_conf,
                    'recognition_similarity': similarity,
                    'is_known': is_known,
                    'embedding': embedding,
                    'last_seen': now,
                    'frames': 0,
                }

                results_list.append({
                    'bbox': current_bbox,
                    'person_name': person_name,
                    'display_name': display_name,
                    'class_name': class_name,
                    'person_id': person_id,
                    'detection_confidence': det_conf,
                    'recognition_similarity': similarity,
                    'is_known': is_known,
                    'embedding': embedding,
                })

    except Exception as e:
        logger.error(f"[EmbeddingEngine] detect_and_recognize error: {e}")

    return results_list


def compute_person_embeddings(person_id: int):
    """
    Compute and store ArcFace embeddings for all images of a given person.
    Skips images that already have an embedding.

    Returns:
        (computed_count, skipped_count, error_count)
    """
    from app.models import Person, PersonImage, PersonEmbedding

    try:
        person = Person.objects.get(id=person_id)
    except Person.DoesNotExist:
        logger.error(f"[EmbeddingEngine] Person {person_id} not found.")
        return 0, 0, 0

    gallery = get_gallery()
    computed = 0
    skipped = 0
    errors = 0

    for pi in PersonImage.objects.filter(person=person):
        # Skip if embedding already exists for this source image
        if PersonEmbedding.objects.filter(person=person, source_image=pi).exists():
            skipped += 1
            continue

        try:
            image_path = pi.image.path
            result = compute_embedding(image_path)
            if result is not None:
                emb, det_conf, _ = result
                PersonEmbedding.objects.create(
                    person=person,
                    source_image=pi,
                    embedding=emb.tolist(),
                )
                gallery.add_embedding(person.id, person.name, emb)
                computed += 1
            else:
                errors += 1
                logger.warning(f"[EmbeddingEngine] No face found in {image_path}")
        except Exception as e:
            errors += 1
            logger.error(f"[EmbeddingEngine] Error computing embedding for image {pi.id}: {e}")

    logger.info(
        f"[EmbeddingEngine] Person '{person.name}': "
        f"{computed} computed, {skipped} skipped, {errors} errors."
    )
    return computed, skipped, errors
