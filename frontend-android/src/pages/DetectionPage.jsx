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
    setIsScanning(false);
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

  const [securityNote, setSecurityNote] = useState('');
  const [noteSubmitting, setNoteSubmitting] = useState(false);
  const [noteSubmitted, setNoteSubmitted] = useState(false);

  // Scanner lock: Next scan is blocked for ANY unknown person until security note is submitted
  const isUnknown = Boolean(
    lastVerification &&
    (lastVerification.status === 'DENIED' || lastVerification.status === 'PENDING_REVIEW')
  );
  const isUnknownPending = isUnknown && !noteSubmitted;

  // Submit security note for suspicious person
  const handleSubmitSecurityNote = async () => {
    if (!lastVerification?.log_id || !securityNote.trim() || noteSubmitting) return;
    setNoteSubmitting(true);
    try {
      await API.post(`/logs/${lastVerification.log_id}/security-note/`, {
        note: securityNote.trim()
      });
      setNoteSubmitted(true);
      if (window.showToast) {
        window.showToast('Security note recorded. Scanner unlocked for next scan.', 'success', 'UNLOCKED');
      }
    } catch (err) {
      console.error('Failed to submit security note:', err);
      if (window.showToast) {
        window.showToast('Failed to submit security note.', 'error', 'ERROR');
      }
    } finally {
      setNoteSubmitting(false);
    }
  };

  // Single-shot Biometric Verification
  const handleScanPerson = async () => {
    if (!videoRef.current || !canvasRef.current || isScanning) return;

    // Guard: Block next scan if previous unknown note was not submitted
    if (isUnknownPending) {
      if (window.showToast) {
        window.showToast('Please submit a security note for the unknown person before scanning again.', 'warning', 'LOCKED');
      }
      return;
    }

    try {
      setIsScanning(true);
      setSecurityNote('');
      setNoteSubmitted(false);
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
      } else if (result.status === 'PENDING_REVIEW') {
        if (window.showToast) {
          window.showToast(`⚠️ ESCALATED: Unknown person detected ${result.unknown_count_today}+ times — Sent to Admin`, 'warning', 'REVIEW');
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

      if (result.status === 'ALLOWED' || result.status === 'DENIED' || result.status === 'PENDING_REVIEW') {
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

          {/* Camera switch button (top-right) */}
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

        {/* Start / Stop Toggle + Scan Button Row */}
        <div className="d-flex justify-content-center align-items-center gap-3 mb-3 w-100 px-2" style={{ maxWidth: '400px', margin: '0 auto' }}>
          {/* Scan & Verify Button */}
          <button
            type="button"
            className="btn py-2.5 rounded-pill fw-bold shadow-lg d-inline-flex align-items-center justify-content-center gap-2"
            onClick={handleScanPerson}
            disabled={isScanning || !isCameraActive || isUnknownPending}
            style={{
              flex: 1,
              fontSize: '1rem',
              letterSpacing: '0.3px',
              background: isUnknownPending
                ? 'linear-gradient(135deg, #475569 0%, #334155 100%)'
                : isScanning
                ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)'
                : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              boxShadow: isUnknownPending
                ? '0 4px 12px rgba(0, 0, 0, 0.25)'
                : isScanning
                ? '0 4px 18px rgba(14, 165, 233, 0.5)'
                : '0 4px 18px rgba(37, 99, 235, 0.45)',
              border: isUnknownPending
                ? '1.5px solid rgba(239, 68, 68, 0.5)'
                : '1px solid rgba(255, 255, 255, 0.2)',
              color: '#ffffff',
              textShadow: '0 1px 2px rgba(0,0,0,0.25)',
              opacity: (!isCameraActive && !isScanning && !isUnknownPending) ? 0.75 : 1,
              cursor: isUnknownPending ? 'not-allowed' : (!isCameraActive ? 'not-allowed' : 'pointer'),
              transition: 'all 0.25s ease',
            }}
            title={isUnknownPending ? "Please submit security note to unlock next scan" : (!isCameraActive ? "Start camera first" : "Scan person")}
          >
            {isScanning ? (
              <>
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                <span>Verifying...</span>
              </>
            ) : isUnknownPending ? (
              <>
                <i className="bi bi-shield-lock-fill fs-5 text-warning"></i>
                <span>Locked (Note Req.)</span>
              </>
            ) : (
              <>
                <i className="bi bi-camera-fill fs-5"></i>
                <span>Scan</span>
              </>
            )}
          </button>

          {/* Start / Stop Camera Toggle */}
          <button
            type="button"
            className="btn py-2.5 rounded-pill fw-bold shadow-lg d-inline-flex align-items-center justify-content-center gap-2"
            onClick={() => isCameraActive ? stopCamera() : startCamera(facingMode)}
            style={{
              flex: 1,
              fontSize: '1rem',
              letterSpacing: '0.3px',
              background: isCameraActive
                ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              boxShadow: isCameraActive
                ? '0 4px 18px rgba(239, 68, 68, 0.45)'
                : '0 4px 18px rgba(16, 185, 129, 0.45)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#ffffff',
              textShadow: '0 1px 2px rgba(0,0,0,0.25)',
              transition: 'all 0.25s ease',
            }}
          >
            <i className={`bi ${isCameraActive ? 'bi-stop-fill' : 'bi-play-fill'} fs-5`}></i>
            <span>{isCameraActive ? 'Stop' : 'Start'}</span>
          </button>
        </div>

        {/* Scanner Lock Notice when unknown detected */}
        {isUnknownPending && (
          <div
            className="card border-0 p-3 mb-3 mx-2 rounded-4 shadow-sm"
            style={{
              background: 'linear-gradient(135deg, rgba(254, 242, 242, 0.96) 0%, rgba(254, 226, 226, 0.96) 100%)',
              borderLeft: '5px solid #dc2626',
            }}
          >
            <div className="d-flex align-items-center gap-2.5">
              <div className="rounded-circle p-2 d-flex align-items-center justify-content-center flex-shrink-0" style={{ background: 'rgba(220, 38, 38, 0.12)' }}>
                <i className="bi bi-shield-lock-fill text-danger fs-4"></i>
              </div>
              <div className="flex-grow-1">
                <div className="fw-bold text-danger" style={{ fontSize: '0.88rem' }}>
                  Next Scan Locked
                </div>
                <div className="small" style={{ fontSize: '0.78rem', lineHeight: '1.35', color: '#7f1d1d' }}>
                  Unknown person detected. You must submit a security note below before taking the next scan.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Decision Banner (Result HUD) */}
        {lastVerification && (
          <div
            className={`card border-0 p-3 mb-3 rounded-4 shadow-sm animate__animated animate__fadeIn mx-2`}
            style={{
              background:
                lastVerification.status === 'ALLOWED'
                  ? 'linear-gradient(135deg, rgba(220, 252, 231, 0.95) 0%, rgba(187, 247, 208, 0.95) 100%)'
                  : lastVerification.status === 'PENDING_REVIEW'
                  ? 'linear-gradient(135deg, rgba(254, 243, 199, 0.95) 0%, rgba(253, 230, 138, 0.95) 100%)'
                  : lastVerification.status === 'DENIED'
                  ? 'linear-gradient(135deg, rgba(254, 226, 226, 0.95) 0%, rgba(254, 202, 202, 0.95) 100%)'
                  : 'rgba(30, 41, 59, 0.85)',
              borderLeft:
                lastVerification.status === 'ALLOWED'
                  ? '5px solid #10b981'
                  : lastVerification.status === 'PENDING_REVIEW'
                  ? '5px solid #d97706'
                  : lastVerification.status === 'DENIED'
                  ? '5px solid #dc2626'
                  : '5px solid #94a3b8',
              backdropFilter: 'blur(10px)',
            }}
          >
            <div className="d-flex align-items-center gap-3">
              {/* Photo thumbnail */}
              {lastVerification.image_url ? (
                <img
                  src={lastVerification.image_url}
                  alt="Captured scan"
                  className="rounded-3 shadow-sm flex-shrink-0"
                  style={{ width: '68px', height: '68px', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.2)' }}
                />
              ) : (
                <div
                  className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0"
                  style={{ width: '68px', height: '68px', background: 'rgba(255,255,255,0.1)' }}
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
                        : lastVerification.status === 'PENDING_REVIEW'
                        ? 'text-white'
                        : lastVerification.status === 'DENIED'
                        ? 'bg-danger text-white'
                        : 'bg-secondary text-white'
                    }`}
                    style={{ 
                      fontSize: '0.7rem',
                      ...(lastVerification.status === 'PENDING_REVIEW' ? { background: '#d97706' } : {})
                    }}
                  >
                    {lastVerification.status === 'ALLOWED'
                      ? '✓ ACCESS GRANTED'
                      : lastVerification.status === 'PENDING_REVIEW'
                      ? '⚠ ESCALATED TO ADMIN'
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

                <h5 className="fw-bold mb-0" style={{ 
                  color: lastVerification.status === 'ALLOWED' ? '#14532d' : 
                         lastVerification.status === 'PENDING_REVIEW' ? '#78350f' :
                         (lastVerification.status === 'DENIED' ? '#7f1d1d' : '#f8fafc'), 
                  fontSize: '1.05rem' 
                }}>
                  {lastVerification.person_name || (lastVerification.status === 'DENIED' || lastVerification.status === 'PENDING_REVIEW' ? 'Unregistered Person / Stranger' : 'No Face Found')}
                </h5>
                <p className="small mb-0" style={{ 
                  color: lastVerification.status === 'ALLOWED' ? '#166534' : 
                         lastVerification.status === 'PENDING_REVIEW' ? '#92400e' :
                         (lastVerification.status === 'DENIED' ? '#991b1b' : '#cbd5e1'), 
                  fontSize: '0.8rem' 
                }}>
                  {lastVerification.department && `${lastVerification.department} • `}
                  {lastVerification.role || lastVerification.message}
                </p>
              </div>
            </div>

            {/* Security Note Input — Mandatory for every unknown person (DENIED or PENDING_REVIEW) */}
            {(lastVerification.status === 'DENIED' || lastVerification.status === 'PENDING_REVIEW') && (
              <div className="mt-3 pt-2.5" style={{ borderTop: '1px solid rgba(0,0,0,0.1)' }}>
                {!noteSubmitted ? (
                  <>
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <label className="form-label fw-bold mb-0 d-flex align-items-center gap-1.5" style={{ fontSize: '0.82rem', color: lastVerification.status === 'PENDING_REVIEW' ? '#78350f' : '#7f1d1d' }}>
                        <i className="bi bi-shield-exclamation text-danger fs-6"></i>
                        <span>Security Note (Required to unlock next scan)</span>
                      </label>
                      <span className="badge rounded-pill bg-danger text-white px-2 py-0.5" style={{ fontSize: '0.66rem', fontWeight: '600' }}>
                        <i className="bi bi-lock-fill me-1"></i> Scan Paused
                      </span>
                    </div>

                    {/* Quick Tag Suggestion Chips */}
                    <div className="d-flex flex-wrap gap-1.5 mb-2">
                      <span className="text-muted small me-1 align-self-center" style={{ fontSize: '0.7rem' }}>Quick tag:</span>
                      {[
                        'Unregistered visitor',
                        'Suspicious activity',
                        'No badge / ID card',
                        'Clearance denied',
                        'Verified safe visitor',
                      ].map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          className="btn btn-sm rounded-pill px-2.5 py-0.5 border"
                          onClick={() => {
                            setSecurityNote((prev) => {
                              if (!prev) return tag;
                              const combined = `${prev}, ${tag}`;
                              const words = combined.split(/\s+/).filter(Boolean);
                              return words.length <= 100 ? combined : prev;
                            });
                          }}
                          style={{
                            fontSize: '0.72rem',
                            background: 'rgba(255, 255, 255, 0.75)',
                            borderColor: 'rgba(0, 0, 0, 0.15)',
                            color: '#1e293b',
                          }}
                        >
                          + {tag}
                        </button>
                      ))}
                    </div>

                    <textarea
                      className="form-control rounded-3 mb-2"
                      rows={2}
                      maxLength={600}
                      placeholder="Type details about this unknown person (behavior, reason, clothing, etc. - up to 100 words)..."
                      value={securityNote}
                      onChange={(e) => {
                        const words = e.target.value.split(/\s+/).filter(Boolean);
                        if (words.length <= 100) {
                          setSecurityNote(e.target.value);
                        }
                      }}
                      style={{
                        fontSize: '0.82rem',
                        background: 'rgba(255,255,255,0.9)',
                        border: '1.5px solid rgba(220, 38, 38, 0.35)',
                        resize: 'none',
                      }}
                    />
                    <div className="d-flex align-items-center justify-content-between">
                      <span className="text-muted" style={{ fontSize: '0.72rem' }}>
                        {securityNote.trim().split(/\s+/).filter(Boolean).length}/100 words
                      </span>
                      <button
                        type="button"
                        className="btn btn-sm rounded-pill fw-bold px-3 py-1.5 d-inline-flex align-items-center gap-1.5 shadow-sm"
                        disabled={!securityNote.trim() || noteSubmitting}
                        onClick={handleSubmitSecurityNote}
                        style={{
                          fontSize: '0.8rem',
                          background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                          color: '#fff',
                          border: 'none',
                          opacity: !securityNote.trim() ? 0.6 : 1,
                          cursor: !securityNote.trim() ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {noteSubmitting ? (
                          <>
                            <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                            <span>Submitting...</span>
                          </>
                        ) : (
                          <>
                            <i className="bi bi-unlock-fill"></i>
                            <span>Submit Note &amp; Unlock Next Scan</span>
                          </>
                        )}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="p-2.5 rounded-3 d-flex align-items-center justify-content-between" style={{ background: 'rgba(22, 163, 74, 0.12)', border: '1px solid rgba(22, 163, 74, 0.3)' }}>
                    <div className="d-flex align-items-center gap-2">
                      <i className="bi bi-check-circle-fill text-success fs-5"></i>
                      <div>
                        <span className="fw-bold small d-block" style={{ color: '#166534', fontSize: '0.82rem' }}>
                          Security Note Submitted for Admin Review
                        </span>
                        <span className="text-secondary small fst-italic" style={{ fontSize: '0.75rem' }}>
                          "{securityNote}"
                        </span>
                      </div>
                    </div>
                    <span className="badge bg-success text-white rounded-pill px-2.5 py-1 fw-bold" style={{ fontSize: '0.7rem' }}>
                      <i className="bi bi-unlock-fill me-1"></i> Scanner Ready
                    </span>
                  </div>
                )}
              </div>
            )}
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
                      <div className="text-muted" style={{ fontSize: '0.68rem' }}>{scan.department || (scan.status === 'DENIED' || scan.status === 'PENDING_REVIEW' ? 'Unauthorized' : 'General')}</div>
                    </div>
                  </div>
                  <span 
                    className={`badge rounded-pill ${scan.status === 'ALLOWED' ? 'bg-success' : scan.status === 'PENDING_REVIEW' ? '' : 'bg-danger'}`} 
                    style={{ 
                      fontSize: '0.65rem',
                      ...(scan.status === 'PENDING_REVIEW' ? { background: '#d97706', color: '#fff' } : {})
                    }}
                  >
                    {scan.status === 'PENDING_REVIEW' ? 'REVIEW' : scan.status}
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
