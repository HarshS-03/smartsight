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
# Cloud Sync disabled (Local-only NPZ cache)
# ---------------------------------------------------------------------------
def _sync_npz_to_supabase(filepath):
    pass

def trigger_debounced_supabase_sync(filepath, delay=8.0):
    pass

def _download_npz_from_supabase(filepath):
    return False


# ---------------------------------------------------------------------------
# Lazy model loading (InsightFace SCRFD + ArcFace)
# ---------------------------------------------------------------------------
_models_lock = threading.Lock()
_insightface_app = None


def get_face_analysis_app():
    """
    Lazy-load InsightFace FaceAnalysis engine with SCRFD detector + ArcFace recognizer.
    Uses 'buffalo_sc' for fast, lightweight, and landmark-aligned face processing.
    """
    global _insightface_app
    if _insightface_app is None:
        with _models_lock:
            if _insightface_app is None:
                try:
                    from insightface.app import FaceAnalysis
                    det_size = getattr(settings, 'SCRFD_DETECTION_SIZE', (640, 640))
                    app = FaceAnalysis(
                        name='buffalo_sc',
                        allowed_modules=['detection', 'recognition'],
                        providers=['CPUExecutionProvider']
                    )
                    app.prepare(ctx_id=0, det_size=det_size)
                    _insightface_app = app
                    logger.info("[EmbeddingEngine] InsightFace (SCRFD + ArcFace) engine initialized successfully.")
                except Exception as e:
                    logger.error(f"[EmbeddingEngine] Failed to load InsightFace FaceAnalysis: {e}")
                    raise e
    return _insightface_app


def _get_arcface():
    """Compatibility getter for direct ArcFace model reference."""
    app = get_face_analysis_app()
    return app.models.get('recognition')


def _get_face_detector(model_name=None):
    """Compatibility getter for detection model reference."""
    app = get_face_analysis_app()
    return app.models.get('detection')



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

    def _save_cache(self):
        """Save current matrix and metadata to disk."""
        if self._matrix is not None:
            names = np.array([m[0] for m in self._meta])
            pids = np.array([m[1] for m in self._meta])
            np.savez_compressed(self.cache_file, matrix=self._matrix, names=names, pids=pids)
            
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
        """Load from NPZ cache."""
        self._refresh_person_info()
        with self._lock:
            if os.path.exists(self.cache_file):
                try:
                    data = np.load(self.cache_file, allow_pickle=True)
                    self._matrix = data['matrix']
                    self._meta = list(zip(data['names'], data['pids']))
                    self._gallery.clear()
                    for (name, pid), emb in zip(self._meta, self._matrix):
                        self._gallery.setdefault(pid, []).append((emb, name))
                    self._loaded = True
                    logger.info(f"[Gallery] Loaded embeddings instantly from cache.")
                    return
                except Exception as e:
                    logger.warning(f"[Gallery] Failed to load cache: {e}.")
            
            logger.error("[Gallery] NPZ file missing or corrupt. Cannot load gallery.")
            self._loaded = True # Prevent endless loops

    def reload(self):
        """Force full reload from cache."""
        self.load_gallery()

    def ensure_loaded(self):
        """Load gallery on first access (lazy init)."""
        if not self._loaded:
            self.load_gallery()

    # ------------------------------------------------------------------
    # Hot-update (no restart needed)
    # ------------------------------------------------------------------
    def add_embedding(self, person_id: int, person_name: str, embedding, save_cache: bool = True):
        """Add a single embedding to the in-memory gallery (instant, no restart)."""
        emb = np.array(embedding, dtype=np.float32)
        norm = np.linalg.norm(emb)
        if norm > 0:
            emb = emb / norm
        with self._lock:
            self._gallery.setdefault(person_id, []).append((emb, person_name))
            if save_cache:
                self._rebuild_matrix()
                self._save_cache()

    def add_embeddings_batch(self, person_id: int, person_name: str, embeddings_list):
        """Add multiple embeddings at once and write to disk only once."""
        if not embeddings_list:
            return
        with self._lock:
            target = self._gallery.setdefault(person_id, [])
            for raw_emb in embeddings_list:
                emb = np.array(raw_emb, dtype=np.float32)
                norm = np.linalg.norm(emb)
                if norm > 0:
                    emb = emb / norm
                target.append((emb, person_name))
            self._rebuild_matrix()
            self._save_cache()

    def remove_person(self, person_id: int):
        """Remove all embeddings for a person from in-memory gallery."""
        with self._lock:
            self._gallery.pop(person_id, None)
            self._rebuild_matrix()
            self._save_cache()

    def remove_embedding_by_source(self, person_id: int, source_image_id: int):
        """Deprecated: Cannot selectively remove without JSONField source map."""
        pass

    def update_person_meta(self, person_id: int, new_name: str = None, category: str = None, class_name: str = None, department: str = None):
        """Update a person's name and metadata across in-memory structures and disk cache."""
        with self._lock:
            if person_id in self._gallery and new_name:
                updated_entries = []
                for emb, _ in self._gallery[person_id]:
                    updated_entries.append((emb, new_name))
                self._gallery[person_id] = updated_entries
                self._rebuild_matrix()
                self._save_cache()

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
    def match(self, embedding, threshold: float = 0.45):
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
    Compute a 512-d ArcFace embedding from a cropped region using InsightFace ONNX.
    """
    if crop_bgr is None or crop_bgr.size == 0:
        return None

    h, w = crop_bgr.shape[:2]
    if h < 20 or w < 20:
        return None

    try:
        with _arcface_infer_lock:
            model = _get_arcface()
            if hasattr(model, 'get_feat'):
                # InsightFace recognition model directly extracts 512d normalized embedding
                raw_emb = model.get_feat(crop_bgr)
            elif hasattr(model, 'predict_on_batch'):
                crop_rgb = cv.cvtColor(crop_bgr, cv.COLOR_BGR2RGB)
                crop_resized = cv.resize(crop_rgb, (112, 112), interpolation=cv.INTER_AREA)
                img_input = (crop_resized.astype(np.float32) - 127.5) / 128.0
                img_input = np.expand_dims(img_input, axis=0)
                raw_emb = model.predict_on_batch(img_input)[0]
            else:
                return None

        emb = np.array(raw_emb, dtype=np.float32).flatten()
        norm = np.linalg.norm(emb)
        if norm > 0:
            emb = emb / norm
        return emb
    except Exception as e:
        logger.error(f"[EmbeddingEngine] embed_face_crop error: {e}")

    return None


def compute_embedding(image_or_path, model_name=None):
    """
    Compute a 512-d ArcFace embedding for an image using SCRFD detection and 5-point landmark alignment.
    Returns: (embedding_512d_np, detection_confidence, aligned_face_bgr) or None
    """
    app = get_face_analysis_app()

    try:
        if isinstance(image_or_path, str):
            img = cv.imread(image_or_path)
            if img is None:
                return None
        else:
            img = image_or_path

        faces = app.get(img)
        if not faces:
            # Fallback to direct crop embedding if already tightly cropped
            emb = embed_face_crop(img)
            if emb is not None:
                return (emb, 0.5, img)
            return None

        # Pick best face by detection score
        best_face = max(faces, key=lambda f: float(f.det_score))
        det_conf = float(best_face.det_score)

        embedding = best_face.embedding
        if embedding is not None:
            norm = np.linalg.norm(embedding)
            if norm > 0:
                embedding = (embedding / norm).astype(np.float32)

        # Extract aligned or cropped face region for preview
        bx1, by1, bx2, by2 = best_face.bbox.astype(int)
        h, w = img.shape[:2]
        x1, y1 = max(0, bx1), max(0, by1)
        x2, y2 = min(w, bx2), min(h, by2)
        face_crop = img[y1:y2, x1:x2].copy()

        return (embedding, det_conf, face_crop)

    except Exception as e:
        logger.error(f"[EmbeddingEngine] compute_embedding error: {e}")

    return None


# ---------------------------------------------------------------------------
# Face Detection & Recognition Pipeline (SCRFD + Landmark Alignment)
# ---------------------------------------------------------------------------

def detect_and_recognize(frame, threshold=None, max_faces=10, model_name=None, check_spoof=False):
    """
    High-performance SCRFD + 5-Point Landmark Aligned ArcFace pipeline.
    Eliminates video tracking delays for instant, precise image recognition.
    """
    if frame is None or frame.size == 0:
        return []

    if threshold is None:
        threshold = getattr(settings, 'ARCFACE_SIMILARITY_THRESHOLD', 0.45)

    det_conf_thresh = getattr(settings, 'ARCFACE_DETECTION_CONFIDENCE', 0.40)
    app = get_face_analysis_app()
    gallery = get_gallery()
    results_list = []

    try:
        # Run SCRFD detector + ArcFace with 5-point facial landmark alignment
        faces = app.get(frame)
        if not faces:
            return results_list

        # Sort by confidence / size and limit to max_faces
        valid_faces = [f for f in faces if float(f.det_score) >= det_conf_thresh]
        valid_faces.sort(key=lambda f: float(f.det_score), reverse=True)
        valid_faces = valid_faces[:max_faces]

        for face in valid_faces:
            bx1, by1, bx2, by2 = face.bbox.astype(int)
            det_conf = float(face.det_score)
            kps = face.kps.tolist() if face.kps is not None else []
            current_bbox = (int(bx1), int(by1), int(bx2), int(by2))

            # Anti-spoof check if requested
            is_real = True
            spoof_score = 1.0
            if check_spoof:
                from app.utils.antispoof import check_liveness
                is_real, spoof_score, _ = check_liveness(frame, bbox=current_bbox)
                if not is_real:
                    results_list.append({
                        'bbox': current_bbox,
                        'kps': kps,
                        'person_name': 'Spoof Attempt',
                        'display_name': 'Spoof Alert',
                        'class_name': '',
                        'person_id': None,
                        'detection_confidence': det_conf,
                        'recognition_similarity': 0.0,
                        'is_known': False,
                        'is_real': False,
                        'spoof_score': spoof_score,
                        'embedding': None,
                    })
                    continue

            # Normalized 512-D embedding from InsightFace
            embedding = face.embedding
            if embedding is not None:
                norm = np.linalg.norm(embedding)
                if norm > 0:
                    embedding = (embedding / norm).astype(np.float32)

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

            results_list.append({
                'bbox': current_bbox,
                'kps': kps,
                'person_name': person_name,
                'display_name': display_name,
                'class_name': class_name,
                'person_id': person_id,
                'detection_confidence': det_conf,
                'recognition_similarity': similarity,
                'is_known': is_known,
                'is_real': is_real,
                'spoof_score': spoof_score,
                'embedding': embedding,
            })

    except Exception as e:
        logger.error(f"[EmbeddingEngine] detect_and_recognize error: {e}")

    return results_list


def compute_person_embeddings(person_id: int, delete_invalid_images: bool = False):
    """
    Compute and store ArcFace embeddings for all images of a given person.
    Skips images that already have an embedding.
    If delete_invalid_images is True, images without detectable faces or missing files
    are deleted from disk and the database.

    Returns:
        (computed_count, skipped_count, error_count, deleted_count) if delete_invalid_images
        else (computed_count, skipped_count, error_count)
    """
    from app.models import Person, PersonImage

    try:
        person = Person.objects.get(id=person_id)
    except Person.DoesNotExist:
        logger.error(f"[EmbeddingEngine] Person {person_id} not found.")
        return (0, 0, 0, 0) if delete_invalid_images else (0, 0, 0)

    gallery = get_gallery()
    # Clear existing to prevent duplicates during recompute
    gallery.remove_person(person.id)
    
    computed = 0
    skipped = 0
    errors = 0
    deleted = 0

    embeddings_to_add = []
    from django.conf import settings
    dataset_dir = os.path.join(settings.MEDIA_ROOT, 'dataset', person.name)

    for pi in list(PersonImage.objects.filter(person=person)):
        try:
            image_path = pi.image.path if pi.image else None
            # If path on disk does not exist, check fallback in person's dataset folder
            if not image_path or not os.path.exists(image_path):
                filename = os.path.basename(pi.image.name) if pi.image else ""
                candidate = os.path.join(dataset_dir, filename)
                if os.path.exists(candidate):
                    image_path = candidate

            if not image_path or not os.path.exists(image_path):
                errors += 1
                if delete_invalid_images:
                    logger.info(f"[EmbeddingEngine] Deleting missing image record {pi.id} from DB")
                    pi.delete()
                    deleted += 1
                continue

            result = compute_embedding(image_path)
            if result is not None:
                emb, det_conf, _ = result
                embeddings_to_add.append(emb)
                computed += 1
            else:
                errors += 1
                logger.warning(f"[EmbeddingEngine] No face found in {image_path}")
                if delete_invalid_images:
                    logger.info(f"[EmbeddingEngine] Deleting image without face {image_path} (ID: {pi.id})")
                    try:
                        if os.path.isfile(image_path):
                            os.remove(image_path)
                    except Exception as rm_err:
                        logger.warning(f"[EmbeddingEngine] Could not remove file {image_path}: {rm_err}")
                    pi.delete()
                    deleted += 1
        except Exception as e:
            errors += 1
            logger.error(f"[EmbeddingEngine] Error computing embedding for image {pi.id}: {e}")

    if embeddings_to_add:
        gallery.add_embeddings_batch(person.id, person.name, embeddings_to_add)

    logger.info(
        f"[EmbeddingEngine] Person '{person.name}': "
        f"{computed} computed, {skipped} skipped, {errors} errors, {deleted} deleted."
    )


    if delete_invalid_images:
        return computed, skipped, errors, deleted
    return computed, skipped, errors



import atexit
def _on_server_shutdown():
    if _gallery_instance is not None and _gallery_instance._loaded:
        from django.conf import settings
        if getattr(settings, 'SUPABASE_SYNC_ENABLED', True):
            logger.info('[Gallery] Server shutting down, uploading final embeddings to Supabase...')
            _sync_npz_to_supabase(_gallery_instance.cache_file)
atexit.register(_on_server_shutdown)
