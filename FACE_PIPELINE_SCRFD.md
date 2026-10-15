# SmartSight Face Pipeline: SCRFD + Alignment + Anti-Spoofing

## 1. Overview & Problem Analysis

Pehle ka pipeline real-time video streaming ko dhyan me rakhkar banaya gaya tha:
* **YOLOv8-Face (`yolo26n-face.pt`)**: Sirf rectangular bounding box deta tha, facial landmarks nahi.
* **Manual Crop**: Box ko sidha crop karke ArcFace ko bheja jata tha. Agar user ka face tilt ho ya angle par ho, toh recognition score drop ho jata tha.
* **IoU Tracking**: Frames ke beech tracking maintain karta tha, jo **Single Image Scan / Photo Upload** use-case ke liye unnecessary overhead hai.

### Proposed Architecture (Image-Optimized Pipeline)
1. **Face Detection**: **SCRFD** (InsightFace ka official detector). Ultra-light, fast aur accurate.
2. **Landmark Extraction**: 5 Facial Landmarks (dono aankhein, naak, hoth ke dono corners).
3. **Anti-Spoofing**: **MiniFASNet V2 ONNX** (Silent-Face-Anti-Spoofing) - Screen/Photo attack filter karne ke liye.
4. **Norm-Crop (Face Alignment)**: 5 landmarks se affine transform karke perfectly centered 112×112 face banana.
5. **Feature Extraction**: **ArcFace** (512-D L2-normalized embedding).
6. **Gallery Match**: Cosine similarity match against in-memory database gallery.

---

## 2. Pipeline Flow Diagram

```
                 [ Input Image (Upload / Scan) ]
                               │
                               ▼
        ┌──────────────────────────────────────────────┐
        │        1. SCRFD Face Detector (ONNX)         │
        │  • Detects Bounding Box (x1, y1, x2, y2)     │
        │  • Extracts 5-Point Landmarks (KPS)          │
        └──────────────────────┬───────────────────────┘
                               │
                               ▼
        ┌──────────────────────────────────────────────┐
        │      2. Anti-Spoof Check (MiniFASNet)        │
        │  • Real vs Fake Face (Screen / Print attack) │
        └──────────────┬───────────────────────────────┘
                       │
             [ Is Face Real? ]
             ├── NO  ──► Status: "SPOOF_DETECTED" (Reject)
             │
             └── YES ──►
                               │
                               ▼
        ┌──────────────────────────────────────────────┐
        │     3. 5-Point Landmark Face Alignment       │
        │  • Affine Transformation / Similarity Warp   │
        │  • Aligns tilted/rotated face to 112x112     │
        └──────────────────────┬───────────────────────┘
                               │
                               ▼
        ┌──────────────────────────────────────────────┐
        │     4. ArcFace Recognition (w600k / MBF)     │
        │  • Generates 512-Dimensional Vector          │
        │  • L2 Normalization                          │
        └──────────────────────┬───────────────────────┘
                               │
                               ▼
        ┌──────────────────────────────────────────────┐
        │      5. Database Gallery Cosine Match        │
        │  • Fast Matrix Dot Product with Gallery Cache │
        │  • Sim >= Threshold (0.45) ➔ Known Person    │
        │  • Sim < Threshold ➔ Unknown Face            │
        └──────────────────────────────────────────────┘
```

---

## 3. Comparison: Purana vs Naya Pipeline

| Component | Purana Pipeline | Naya Pipeline (SCRFD + InsightFace) |
| :--- | :--- | :--- |
| **Detector** | YOLOv8-Face (`.pt` PyTorch) | **SCRFD (`buffalo_sc` ONNX)** |
| **Landmarks** | None (sirf box) | **5 Keypoints (Eyes, Nose, Mouth)** |
| **Alignment** | No alignment (raw crop) | **Affine Warped (112×112 normalized)** |
| **Tilt Handling** | Weak (Similarity drop hoti hai) | **Robust (Chehra seedha ho jata hai)** |
| **Tracking** | IoU Frame Tracker (Video based) | **Bypassed for image scans (Zero overhead)** |
| **Calls** | 2 alag calls (YOLO + ArcFace) | **1 unified call (`app.get(image)`)** |
| **Performance** | Extra memory for PyTorch YOLO | **Pure ONNX Runtime (CPU optimized)** |

---

## 4. Production Code Implementation

### File: `app/utils/scrfd_pipeline.py`

```python
import logging
import numpy as np
import cv2 as cv
from django.conf import settings
from insightface.app import FaceAnalysis
from app.utils.antispoof import check_anti_spoof
from app.utils.embedding_engine import get_gallery

logger = logging.getLogger(__name__)

_face_analysis_app = None

def get_scrfd_app():
    """
    Lazy-load InsightFace Analysis App with SCRFD Detector + ArcFace Recognizer.
    Using 'buffalo_sc' for CPU lightweight high-speed processing.
    """
    global _face_analysis_app
    if _face_analysis_app is None:
        logger.info("[SCRFD Pipeline] Initializing InsightFace buffalo_sc (SCRFD + ArcFace)...")
        app = FaceAnalysis(
            name='buffalo_sc',
            allowed_modules=['detection', 'recognition'],
            providers=['CPUExecutionProvider']
        )
        # det_size=(640, 640) standard balance for accuracy and speed
        app.prepare(ctx_id=0, det_size=(640, 640))
        _face_analysis_app = app
        logger.info("[SCRFD Pipeline] Engine ready.")
    return _face_analysis_app


def scan_single_image(image_bgr, threshold=None, check_spoof=True):
    """
    Complete end-to-end image scanning pipeline.
    
    Args:
        image_bgr (np.ndarray): Input OpenCV BGR image.
        threshold (float, optional): Cosine similarity threshold (defaults to 0.45).
        check_spoof (bool): Whether to run MiniFASNet anti-spoof check.
        
    Returns:
        dict: Standardized detection and recognition response.
    """
    if image_bgr is None or image_bgr.size == 0:
        return {'status': 'ERROR', 'message': 'Invalid image provided', 'results': []}

    if threshold is None:
        threshold = getattr(settings, 'ARCFACE_SIMILARITY_THRESHOLD', 0.45)

    app = get_scrfd_app()
    gallery = get_gallery()

    # 1. SCRFD Detection + Landmarks + Landmark Alignment + ArcFace Embedding
    # app.get() internally executes:
    #   - SCRFD Detection (BBox + 5 Landmarks)
    #   - Face norm_crop (alignment via 5 landmarks)
    #   - ArcFace feature extraction (512-D embedding)
    faces = app.get(image_bgr)

    if not faces:
        return {'status': 'NO_FACE_DETECTED', 'results': []}

    results = []

    for face in faces:
        bbox = face.bbox.astype(int).tolist()  # [x1, y1, x2, y2]
        det_score = float(face.det_score)
        kps = face.kps.tolist() if face.kps is not None else []

        x1, y1, x2, y2 = bbox
        h, w = image_bgr.shape[:2]
        x1_c, y1_c = max(0, x1), max(0, y1)
        x2_c, y2_c = min(w, x2), min(h, y2)
        face_crop = image_bgr[y1_c:y2_c, x1_c:x2_c]

        # 2. Anti-Spoofing Check
        is_real = True
        spoof_score = 1.0
        if check_spoof and face_crop.size > 0:
            is_real, spoof_score = check_anti_spoof(face_crop)
            if not is_real:
                results.append({
                    'bbox': bbox,
                    'kps': kps,
                    'is_real': False,
                    'spoof_score': round(float(spoof_score), 4),
                    'status': 'SPOOF_DETECTED',
                    'is_known': False,
                    'person_name': 'Fake Face',
                    'display_name': 'Spoof Alert',
                    'similarity': 0.0
                })
                continue

        # 3. Embedding Matching against DB Gallery
        embedding = face.embedding
        if embedding is not None:
            norm = np.linalg.norm(embedding)
            if norm > 0:
                embedding = embedding / norm

        person_name, person_id, similarity = gallery.match(embedding, threshold)
        is_known = person_name is not None

        display_name = 'Unknown'
        class_name = ''
        if is_known:
            p_info = gallery.get_person_info(person_id, person_name)
            class_name = p_info.get('class_name') or p_info.get('department') or ''
            display_name = f"{person_name} [{class_name}]" if class_name else person_name

        results.append({
            'bbox': bbox,
            'kps': kps,
            'is_real': True,
            'spoof_score': round(float(spoof_score), 4),
            'status': 'RECOGNIZED' if is_known else 'UNKNOWN',
            'is_known': is_known,
            'person_id': person_id,
            'person_name': person_name,
            'display_name': display_name,
            'class_name': class_name,
            'detection_confidence': round(det_score, 4),
            'similarity': round(float(similarity), 4)
        })

    return {'status': 'SUCCESS', 'results': results}
```

---

## 5. Usage Example

```python
from app.utils.scrfd_pipeline import scan_single_image

# Read image
image = cv.imread('test_photo.jpg')

# Process image
res = scan_single_image(image, threshold=0.45, check_spoof=True)
print(res)
```

---

## 6. Key Benefits

1. **Zero Redundancy**: BBox, Landmarks aur Embedding ek hi pass (`app.get()`) me nikal aate hain.
2. **Superior Accuracy**: 5-point alignment se tilted/rotated faces par accuracy significantly better milti hai.
3. **No Tracking Lag**: Single image scans me frame tracking ka koi deadweight nahi hoga.
4. **Lightweight & Clean**: YOLOv8-Face dependency ko face detection ke liye discard kiya ja sakta hai.
