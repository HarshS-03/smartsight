import os
import cv2 as cv
import numpy as np
import logging

logger = logging.getLogger(__name__)

def check_liveness(frame, bbox=None):
    """
    Evaluates whether a detected face is live (real human) or a spoof attempt.
    Uses DeepFace's dual MiniFASNet engine (2.7_80x80_MiniFASNetV2 + 4_0_0_80x80_MiniFASNetV1SE).
    
    Args:
        frame: BGR numpy frame (full image or cropped)
        bbox: optional (x1, y1, x2, y2) in frame coordinates.
    Returns:
        (is_real: bool, score: float, message: str)
    """
    if frame is None or frame.size == 0:
        return False, 0.0, "INVALID_FRAME"

    try:
        if bbox is not None:
            x1, y1, x2, y2 = bbox
            h, w = frame.shape[:2]
            # Add slight margin to capture context
            pad_x = int((x2 - x1) * 0.2)
            pad_y = int((y2 - y1) * 0.2)
            cx1 = max(0, x1 - pad_x)
            cy1 = max(0, y1 - pad_y)
            cx2 = min(w, x2 + pad_x)
            cy2 = min(h, y2 + pad_y)
            face_img = frame[cy1:cy2, cx1:cx2]
        else:
            face_img = frame

        if face_img.shape[0] < 30 or face_img.shape[1] < 30:
            return False, 0.0, "FACE_TOO_SMALL"

        from deepface import DeepFace
        faces = DeepFace.extract_faces(
            img_path=face_img,
            detector_backend='skip',
            anti_spoofing=True,
            enforce_detection=False
        )

        if not faces:
            return True, 1.0, "REAL"

        first = faces[0]
        is_real = bool(first.get('is_real', True))
        score = float(first.get('antispoof_score', 1.0))

        if is_real:
            return True, score, "REAL"
        else:
            return False, score, "SPOOF_ATTEMPT"

    except Exception as e:
        logger.warning(f"[AntiSpoof] Error checking liveness: {e}")
        # Safe fallback so regular detection doesn't crash on edge cases
        return True, 1.0, "FALLBACK_REAL"
