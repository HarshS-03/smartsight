import React, { useEffect, useState, useRef } from 'react';
import API from '../api/axios';

/**
 * Resolve a relative media path (e.g. '/media/unknown/img.jpg') to a full
 * URL using the configured server IP so images load correctly on Capacitor.
 */
const resolveMediaUrl = (relativeUrl) => {
  if (!relativeUrl) return null;
  // Already a full URL
  if (relativeUrl.startsWith('http://') || relativeUrl.startsWith('https://')) return relativeUrl;
  // Build from saved server IP
  const savedIp = localStorage.getItem('server_ip');
  if (savedIp) {
    const base = savedIp.trim().replace(/\/+$/, '');
    const origin = base.startsWith('http') ? base : `http://${base}`;
    return `${origin}${relativeUrl.startsWith('/') ? '' : '/'}${relativeUrl}`;
  }
  // Fallback: works in browser dev, won't work on Capacitor
  return relativeUrl;
};

export default function DetectionPage() {
  const [facingMode, setFacingMode] = useState('user'); // 'user' (front selfie) or 'environment' (rear)
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [lastVerification, setLastVerification] = useState(null);
  const [recentScans, setRecentScans] = useState([]);
  const [cameraError, setCameraError] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const mediaStreamRef = useRef(null);

  // Initialize camera
  const startCamera = async (mode = facingMode) => {
    stopCamera();
    setCameraError(null);
    try {
      const constraints = {
        video: {
          facingMode: mode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsCameraActive(true);
    } catch (err) {
      console.error('Error starting mobile camera:', err);
      setCameraError('Camera access failed. Please ensure camera permissions are granted.');
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const toggleFacingMode = () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  useEffect(() => {
    startCamera(facingMode);
    return () => {
      stopCamera();
    };
  }, []);

  // Single-shot Biometric Verification
  const handleScanPerson = async () => {
    if (!videoRef.current || !canvasRef.current || isScanning) return;

    try {
      setIsScanning(true);
      const video = videoRef.current;
      const canvas = canvasRef.current;

      const w = video.videoWidth || 640;
      const h = video.videoHeight || 480;
      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext('2d');
      // If front camera, mirror image on canvas so it looks natural
      if (facingMode === 'user') {
        ctx.translate(w, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, 0, 0, w, h);

      // Get high quality JPEG base64
      const base64Data = canvas.toDataURL('image/jpeg', 0.85);

      const res = await API.post('/biometric/verify/', {
        image: base64Data,
      });

      const result = res.data;
      // Resolve image_url to full server URL for Capacitor
      if (result.image_url) {
        result.image_url = resolveMediaUrl(result.image_url);
      }
      setLastVerification(result);

      if (result.status === 'ALLOWED') {
        if (window.showToast) {
          window.showToast(`ACCESS GRANTED: ${result.person_name} (${result.department || 'Authorized'})`, 'success', 'VERIFIED');
        }
      } else if (result.status === 'DENIED') {
        if (window.showToast) {
          window.showToast('ACCESS DENIED: Unregistered Person / Stranger', 'error', 'UNAUTHORIZED');
        }
      } else {
        if (window.showToast) {
          window.showToast(result.message || 'No face detected clearly. Please align your face.', 'info', 'NOTICE');
        }
      }

      if (result.status === 'ALLOWED' || result.status === 'DENIED') {
        setRecentScans((prev) => [result, ...prev.slice(0, 4)]);
      }
    } catch (err) {
      console.error('Biometric verification failed:', err);
      if (window.showToast) {
        window.showToast('Verification failed. Server connection error.', 'error', 'ERROR');
      }
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div
      className="biometric-page-wrapper py-3 pb-4 d-flex flex-column justify-content-center align-items-center w-100 flex-grow-1"
      style={{ minHeight: 'calc(100vh - 130px)', background: 'transparent' }}
    >
      {/* Hidden processing canvas */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      <div className="container my-auto" style={{ maxWidth: '640px' }}>
        {/* Header Banner */}
        <div className="text-center mb-3">
          <span className="badge rounded-pill bg-primary bg-opacity-10 text-primary px-3 py-1.5 fw-bold mb-1" style={{ fontSize: '0.75rem', letterSpacing: '0.5px' }}>
            <i className="bi bi-shield-check me-1"></i> DEPARTMENT BIOMETRIC ACCESS GATE
          </span>
          <h2 className="fw-bold text-dynamic mb-1" style={{ fontSize: '1.45rem' }}>
            Mobile Scan &amp; Verify
          </h2>
          <p className="text-secondary small mb-0">
            Single-tap instant face biometric verification for entry allowance.
          </p>
        </div>

        {/* Camera Viewport Container */}
        <div
          className="position-relative overflow-hidden rounded-4 shadow-sm mb-3 bg-dark d-flex align-items-center justify-content-center"
          style={{
            height: '380px',
            border: '2px solid rgba(13, 110, 253, 0.25)',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15)',
          }}
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: facingMode === 'user' ? 'scaleX(-1)' : 'none',
            }}
          />

          {/* Scanner Overlay HUD Targeting Lines */}
          <div
            className="position-absolute d-flex flex-column align-items-center justify-content-center pointer-events-none"
            style={{
              width: '220px',
              height: '240px',
              border: isScanning ? '2.5px solid #10b981' : '2px dashed rgba(255, 255, 255, 0.65)',
              borderRadius: '24px',
              boxShadow: isScanning ? '0 0 25px rgba(16, 185, 129, 0.6)' : 'none',
              transition: 'all 0.3s ease',
            }}
          >
            {isScanning && (
              <div
                className="w-100 position-absolute"
                style={{
                  height: '3px',
                  background: '#10b981',
                  boxShadow: '0 0 10px #10b981',
                  top: '50%',
                  animation: 'scannerSweep 1.5s infinite alternate ease-in-out',
                }}
              />
            )}
            <span
              className="badge bg-black bg-opacity-60 text-white rounded-pill px-2.5 py-1"
              style={{ fontSize: '0.68rem', letterSpacing: '0.5px' }}
            >
              {isScanning ? 'ANALYZING BIOMETRICS...' : 'ALIGN FACE HERE'}
            </span>
          </div>

          {/* Camera switch button */}
          <button
            type="button"
            className="btn btn-sm btn-dark position-absolute rounded-circle shadow"
            onClick={toggleFacingMode}
            style={{
              top: '12px',
              right: '12px',
              width: '42px',
              height: '42px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(15, 23, 42, 0.75)',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              zIndex: 10,
            }}
            title="Switch front/back camera"
          >
            <i className="bi bi-arrow-repeat text-white fs-5"></i>
          </button>

          {/* Restart camera if failed */}
          {cameraError && (
            <div className="position-absolute text-center p-3" style={{ zIndex: 12, background: 'rgba(0,0,0,0.85)', borderRadius: '16px' }}>
              <i className="bi bi-camera-video-off text-danger fs-1 mb-2"></i>
              <p className="text-white small mb-2">{cameraError}</p>
              <button className="btn btn-primary btn-sm rounded-pill px-3" onClick={() => startCamera(facingMode)}>
                Retry Camera
              </button>
            </div>
          )}
        </div>

        {/* Primary Action Button: Scan & Verify */}
        <div className="d-flex justify-content-center mb-3">
          <button
            type="button"
            className="btn btn-primary py-2.5 px-4 rounded-pill fw-bold shadow-lg d-inline-flex align-items-center justify-content-center gap-2"
            onClick={handleScanPerson}
            disabled={isScanning || !isCameraActive}
            style={{
              width: '100%',
              maxWidth: '280px',
              fontSize: '0.98rem',
              letterSpacing: '0.3px',
              background: 'linear-gradient(135deg, #0d6efd 0%, #0284c7 100%)',
              border: 'none',
            }}
          >
            {isScanning ? (
              <>
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                <span>Verifying Biometric ID...</span>
              </>
            ) : (
              <>
                <i className="bi bi-camera-fill fs-5"></i>
                <span>Scan &amp; Verify Person</span>
              </>
            )}
          </button>
        </div>

        {/* Decision Banner (Result HUD) */}
        {lastVerification && (
          <div
            className={`card border-0 p-3.5 mb-3 rounded-4 shadow-sm animate__animated animate__fadeIn`}
            style={{
              background:
                lastVerification.status === 'ALLOWED'
                  ? 'linear-gradient(135deg, rgba(220, 252, 231, 0.95) 0%, rgba(187, 247, 208, 0.95) 100%)'
                  : lastVerification.status === 'DENIED'
                  ? 'linear-gradient(135deg, rgba(254, 226, 226, 0.95) 0%, rgba(254, 202, 202, 0.95) 100%)'
                  : 'var(--bg-surface-solid, #ffffff)',
              borderLeft:
                lastVerification.status === 'ALLOWED'
                  ? '5px solid #16a34a'
                  : lastVerification.status === 'DENIED'
                  ? '5px solid #dc2626'
                  : '5px solid #64748b',
            }}
          >
            <div className="d-flex align-items-center gap-3">
              {/* Photo thumbnail */}
              {lastVerification.image_url ? (
                <img
                  src={lastVerification.image_url}
                  alt="Captured scan"
                  className="rounded-3 shadow-sm"
                  style={{ width: '68px', height: '68px', objectFit: 'cover', border: '2px solid #ffffff' }}
                />
              ) : (
                <div
                  className="rounded-3 d-flex align-items-center justify-content-center"
                  style={{ width: '68px', height: '68px', background: '#e2e8f0' }}
                >
                  <i className="bi bi-person-bounding-box fs-2 text-secondary"></i>
                </div>
              )}

              <div className="flex-grow-1">
                <div className="d-flex align-items-center justify-content-between mb-1">
                  <span
                    className={`badge rounded-pill fw-bold px-2.5 py-1 ${
                      lastVerification.status === 'ALLOWED'
                        ? 'bg-success text-white'
                        : lastVerification.status === 'DENIED'
                        ? 'bg-danger text-white'
                        : 'bg-secondary text-white'
                    }`}
                    style={{ fontSize: '0.7rem' }}
                  >
                    {lastVerification.status === 'ALLOWED'
                      ? '✓ ACCESS GRANTED'
                      : lastVerification.status === 'DENIED'
                      ? '✕ ACCESS DENIED'
                      : 'NOTICE'}
                  </span>
                  {lastVerification.confidence > 0 && (
                    <span className="small fw-bold text-muted" style={{ fontSize: '0.72rem' }}>
                      {lastVerification.confidence}% Match
                    </span>
                  )}
                </div>

                <h5 className="fw-bold mb-0" style={{ color: lastVerification.status === 'ALLOWED' ? '#14532d' : '#7f1d1d', fontSize: '1.05rem' }}>
                  {lastVerification.person_name || (lastVerification.status === 'DENIED' ? 'Unregistered Person / Stranger' : 'No Face Found')}
                </h5>
                <p className="small mb-0" style={{ color: '#475569', fontSize: '0.8rem' }}>
                  {lastVerification.department && `${lastVerification.department} • `}
                  {lastVerification.role || lastVerification.message}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Recent Mobile Scans Quick List */}
        {recentScans.length > 0 && (
          <div className="card glass-card border-0 p-3 rounded-4 shadow-sm" style={{ background: 'var(--bg-surface-solid, #ffffff)' }}>
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="fw-bold small text-secondary">Recent Session Scans</span>
              <span className="badge bg-light text-dark">{recentScans.length}</span>
            </div>
            <div className="d-flex flex-column gap-2">
              {recentScans.map((scan, i) => (
                <div key={i} className="d-flex align-items-center justify-content-between p-2 rounded-3 border" style={{ background: 'var(--bg-input, #f8fafc)' }}>
                  <div className="d-flex align-items-center gap-2">
                    {scan.image_url ? (
                      <img src={scan.image_url} alt="Face" className="rounded-circle" style={{ width: '32px', height: '32px', objectFit: 'cover' }} />
                    ) : (
                      <i className="bi bi-person-circle fs-5 text-secondary"></i>
                    )}
                    <div>
                      <div className="fw-bold small" style={{ fontSize: '0.8rem' }}>{scan.person_name || 'Unregistered Person / Stranger'}</div>
                      <div className="text-muted" style={{ fontSize: '0.68rem' }}>{scan.department || (scan.status === 'DENIED' ? 'Unauthorized' : 'General')}</div>
                    </div>
                  </div>
                  <span className={`badge rounded-pill ${scan.status === 'ALLOWED' ? 'bg-success' : 'bg-danger'}`} style={{ fontSize: '0.65rem' }}>
                    {scan.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes scannerSweep {
          0% { top: 15%; opacity: 0.8; }
          100% { top: 85%; opacity: 1; }
        }
      `}</style>
    </div>
  );
}
