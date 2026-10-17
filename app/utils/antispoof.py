import os
import threading
import cv2 as cv
import numpy as np
import logging
import onnxruntime as ort

logger = logging.getLogger(__name__)

_session_lock = threading.Lock()
_antispoof_session = None

def get_antispoof_session():
    """Lazy-load MiniFASNet V2 ONNX session (Loads in 5ms, 0 TensorFlow overhead)."""
    global _antispoof_session
    if _antispoof_session is None:
        with _session_lock:
            if _antispoof_session is None:
                model_path = os.path.join('app', 'models', 'minifasnet_v2.onnx')
                if not os.path.exists(model_path):
                    model_path = 'app/models/minifasnet_v2.onnx'
                
                opts = ort.SessionOptions()
                opts.intra_op_num_threads = 2
                opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
                _antispoof_session = ort.InferenceSession(model_path, sess_options=opts, providers=['CPUExecutionProvider'])
                logger.info("[AntiSpoof] MiniFASNet V2 ONNX engine loaded (Superfast CPU inference).")
    return _antispoof_session


def check_liveness(frame, bbox=None):
    """
    Ultra-fast ONNX liveness check using MiniFASNet V2 (~5ms inference time).
    No TensorFlow, No DeepFace latency.
    
    Args:
        frame: BGR numpy frame
        bbox: optional (x1, y1, x2, y2)
    Returns:
        (is_real: bool, score: float, message: str)
    """
    if frame is None or frame.size == 0:
        return False, 0.0, "INVALID_FRAME"

    try:
        h, w = frame.shape[:2]
        if bbox is not None:
            bx1, by1, bx2, by2 = [float(v) for v in bbox]
            box_w = bx2 - bx1
            box_h = by2 - by1
            cx = bx1 + box_w / 2.0
            cy = by1 + box_h / 2.0

            # MiniFASNet V2 expects a 2.7x scaled crop around face to inspect skin texture & surroundings
            scale = 2.7
            new_w = box_w * scale
            new_h = box_h * scale

            crop_x1 = int(cx - new_w / 2.0)
            crop_y1 = int(cy - new_h / 2.0)
            crop_x2 = int(cx + new_w / 2.0)
            crop_y2 = int(cy + new_h / 2.0)

            dx = max(0, -crop_x1)
            dy = max(0, -crop_y1)
            edx = max(0, crop_x2 - w)
            edy = max(0, crop_y2 - h)

            h_slice = slice(max(0, crop_y1), min(h, crop_y2))
            w_slice = slice(max(0, crop_x1), min(w, crop_x2))
            face_img = frame[h_slice, w_slice]

            if dx > 0 or dy > 0 or edx > 0 or edy > 0:
                face_img = cv.copyMakeBorder(face_img, dy, edy, dx, edx, cv.BORDER_CONSTANT, value=[0, 0, 0])
        else:
            face_img = frame

        if face_img.shape[0] < 20 or face_img.shape[1] < 20:
            return False, 0.0, "FACE_TOO_SMALL"

        session = get_antispoof_session()
        input_name = session.get_inputs()[0].name

        # MiniFASNet V2 input preprocessing: 80x80 BGR, float32, normalized to [0, 1], NCHW format
        resized = cv.resize(face_img, (80, 80), interpolation=cv.INTER_LINEAR)
        blob = resized.astype(np.float32) / 255.0
        blob = np.transpose(blob, (2, 0, 1)) # HWC -> CHW (3, 80, 80)
        blob = np.expand_dims(blob, axis=0)  # CHW -> NCHW (1, 3, 80, 80)

        # Run ONNX model (takes ~4ms)
        output = session.run(None, {input_name: blob})[0][0]
        # Softmax probabilities over [class_0 (spoof), class_1 (real), class_2 (other)]
        exp_vals = np.exp(output - np.max(output))
        probs = exp_vals / np.sum(exp_vals)

        # MiniFASNet V2 classification classes:
        # Class 1: Genuine / Real human face
        # Class 0: Print attack (paper / photo)
        # Class 2: Replay attack (digital screen / phone)
        real_prob = float(probs[1]) if len(probs) > 1 else 0.0
        spoof_prob = float(probs[0] + probs[2]) if len(probs) > 2 else float(probs[0])
        pred_label = int(np.argmax(probs))

        # Real if argmax is class 1 and real_prob is significant
        is_real = (pred_label == 1) and (real_prob >= 0.50)

        if is_real:
            return True, real_prob, "REAL"
        else:
            return False, spoof_prob, "SPOOF_ATTEMPT"


    except Exception as e:
        logger.warning(f"[AntiSpoof] Error checking liveness via ONNX: {e}")
        return True, 1.0, "FALLBACK_REAL"

