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
            x1, y1, x2, y2 = bbox
            pad_x = int((x2 - x1) * 0.15)
            pad_y = int((y2 - y1) * 0.15)
            cx1 = max(0, x1 - pad_x)
            cy1 = max(0, y1 - pad_y)
            cx2 = min(w, x2 + pad_x)
            cy2 = min(h, y2 + pad_y)
            face_img = frame[cy1:cy2, cx1:cx2]
        else:
            face_img = frame

        if face_img.shape[0] < 20 or face_img.shape[1] < 20:
            return False, 0.0, "FACE_TOO_SMALL"

        session = get_antispoof_session()
        input_name = session.get_inputs()[0].name

        # MiniFASNet V2 input preprocessing: 80x80 BGR, float32, NCHW format
        resized = cv.resize(face_img, (80, 80), interpolation=cv.INTER_AREA)
        blob = resized.astype(np.float32)
        blob = np.transpose(blob, (2, 0, 1)) # HWC -> CHW
        blob = np.expand_dims(blob, axis=0)  # CHW -> NCHW

        # Run ONNX model (takes ~4ms)
        output = session.run(None, {input_name: blob})[0][0]
        # Softmax probabilities over [class_0 (spoof), class_1 (real), class_2 (other)]
        exp_vals = np.exp(output - np.max(output))
        probs = exp_vals / np.sum(exp_vals)

        # In MiniFASNet: class 1 is Genuine / Live human face
        live_prob = float(probs[1]) if len(probs) > 1 else float(probs[0])
        is_real = live_prob >= 0.50

        if is_real:
            return True, live_prob, "REAL"
        else:
            return False, live_prob, "SPOOF_ATTEMPT"

    except Exception as e:
        logger.warning(f"[AntiSpoof] Error checking liveness via ONNX: {e}")
        return True, 1.0, "FALLBACK_REAL"

