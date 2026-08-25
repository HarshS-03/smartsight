import asyncio
import json
import logging
import cv2
import numpy as np

logger = logging.getLogger(__name__)

_WEBRTC_PCS = set()


async def process_webrtc_offer(sdp_offer, camera_src='0', model_name='yolov8n_onnx'):
    """
    Handles WebRTC SDP offer from frontend clients, negotiates H.264 video track media,
    and returns an SDP Answer.
    """
    try:
        from aiortc import RTCPeerConnection, RTCSessionDescription, VideoStreamTrack
        from av import VideoFrame

        pc = RTCPeerConnection()
        _WEBRTC_PCS.add(pc)

        @pc.on("connectionstatechange")
        async def on_connectionstatechange():
            if pc.connectionState in ["failed", "closed"]:
                await pc.close()
                _WEBRTC_PCS.discard(pc)

        offer = RTCSessionDescription(sdp=sdp_offer["sdp"], type=sdp_offer["type"])
        await pc.setRemoteDescription(offer)

        answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)

        return {
            "status": "success",
            "sdp": pc.localDescription.sdp,
            "type": pc.localDescription.type
        }
    except ImportError:
        logger.warning("[WebRTC Engine] aiortc module not installed. Returning fallback signal.")
        return {
            "status": "fallback",
            "message": "aiortc not installed. Falling back to HTTP MJPEG streaming."
        }
    except Exception as e:
        logger.error(f"[WebRTC Engine] Error processing offer: {e}")
        return {
            "status": "error",
            "message": str(e)
        }
