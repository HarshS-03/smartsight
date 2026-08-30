import React, { useState, useEffect, useRef } from 'react';
import API from '../api/axios';

export default function LoginPage({ setActivePage, setUser }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);

  const [showFaceModal, setShowFaceModal] = useState(false);
  const [scanStatus, setScanStatus] = useState('Initializing Biometric HUD...');
  const [scanState, setScanState] = useState('scanning'); // scanning, success, error
  const [faceFeedUrl, setFaceFeedUrl] = useState('');
  const [faceCheckInterval, setFaceCheckInterval] = useState(null);
  const faceFeedRef = useRef(null);

  useEffect(() => {
    return () => {
      if (faceCheckInterval) clearInterval(faceCheckInterval);
    };
  }, [faceCheckInterval]);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await API.post('/auth/token/', { username, password });
      localStorage.setItem('access_token', response.data.access);
      localStorage.setItem('refresh_token', response.data.refresh);
      let userRes = null;
      try {
        userRes = await API.get('/auth/me/');
        localStorage.setItem('user', JSON.stringify(userRes.data));
        if (setUser) setUser(userRes.data);
      } catch (meErr) {
        const fallbackUser = { username };
        localStorage.setItem('user', JSON.stringify(fallbackUser));
        if (setUser) setUser(fallbackUser);
      }
      const authenticatedName = (userRes && userRes.data && userRes.data.username) || username;
      if (window.showToast) {
        window.showToast(`Welcome back, ${authenticatedName}! Access Granted.`, 'success', 'WELCOME');
      }
      setActivePage('home');
    } catch (err) {
      if (err.response && err.response.status === 429) {
        const detail = err.response.data && err.response.data.detail;
        if (detail) {
          const match = detail.match(/available in (.*)\./);
          if (match) {
            setError(`Too many attempts. Please try again in ${match[1]}.`);
          } else {
            setError(detail);
          }
        } else {
          setError('Too many attempts. Please try again later.');
        }
      } else {
        setError('Invalid username or password.');
      }
    }
  };

  const videoRef = useRef(null);
  const [useLocalCam, setUseLocalCam] = useState(false);

  const stopFaceLogin = () => {
    if (faceCheckInterval) {
      clearInterval(faceCheckInterval);
      setFaceCheckInterval(null);
    }
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    if (faceFeedRef.current) {
      faceFeedRef.current.src = '';
    }
    setFaceFeedUrl('');
    setUseLocalCam(false);
    setShowFaceModal(false);
    setScanState('scanning');
  };

  const startFaceLogin = async () => {
    const savedIp = localStorage.getItem('server_ip');
    let cleanIp = savedIp ? savedIp.trim().replace(/\/+$/, '') : '';
    let rawBase = cleanIp ? (cleanIp.startsWith('http') ? cleanIp : `http://${cleanIp}`) : (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api');
    const BACKEND_BASE = rawBase.replace(/\/api\/?$/, '');
    const token = Math.random().toString(36).substring(2) + Date.now();
    const feedUrl = `${BACKEND_BASE}/auth/face/feed/?token=${token}`;
    const checkUrl = `${BACKEND_BASE}/auth/face/check/?token=${token}`;

    setShowFaceModal(true);
    setScanState('scanning');
    setScanStatus('Initializing Biometric Camera...');

    if (faceCheckInterval) clearInterval(faceCheckInterval);

    // Try Local Device Camera (Mobile Front Camera) First
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        setUseLocalCam(true);
        setScanStatus('Align Face for Biometric Scanning...');
        setTimeout(() => {
          if (videoRef.current) videoRef.current.srcObject = stream;
        }, 300);

        let successCount = 0;
        const REQUIRED_CONFIRMATIONS = 2;
        const localInterval = setInterval(async () => {
          if (!videoRef.current || !videoRef.current.videoWidth) return;
          try {
            const canvas = document.createElement('canvas');
            canvas.width = videoRef.current.videoWidth || 320;
            canvas.height = videoRef.current.videoHeight || 240;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.7);

            // Use the dedicated face verification endpoint (server-side YOLO recognition)
            const res = await API.post('/auth/face/verify/', { image: dataUrl });
            const data = res.data;

            if (data.status === 'success' && data.username) {
              successCount++;
              setScanStatus(`Face Verified (${successCount}/${REQUIRED_CONFIRMATIONS}) — ${data.username}`);

              if (successCount >= REQUIRED_CONFIRMATIONS) {
                clearInterval(localInterval);
                setScanState('success');
                setScanStatus(`Access Granted! Welcome ${data.username}`);

                // Store JWT tokens returned by the server
                if (data.access) localStorage.setItem('access_token', data.access);
                if (data.refresh) localStorage.setItem('refresh_token', data.refresh);

                const authenticatedUser = data.user || { username: data.username, is_staff: true };
                localStorage.setItem('user', JSON.stringify(authenticatedUser));
                if (setUser) setUser(authenticatedUser);

                if (window.showToast) {
                  window.showToast(`Welcome back, ${data.username}! Access Granted.`, 'success', 'WELCOME');
                }

                setTimeout(() => {
                  stopFaceLogin();
                  setActivePage('home');
                }, 1200);
              }
            } else if (data.status === 'low_confidence') {
              setScanStatus(`Low confidence — move closer (${Math.round((data.confidence || 0) * 100)}%)`);
              successCount = Math.max(0, successCount - 1);
            } else if (data.status === 'no_face') {
              setScanStatus('No face detected — align your face');
              successCount = Math.max(0, successCount - 1);
            } else {
              successCount = Math.max(0, successCount - 1);
            }
          } catch (err) {
            console.warn('Face verify error:', err);
          }
        }, 800);

        setFaceCheckInterval(localInterval);
        return;
      }
    } catch (camErr) {
      console.warn('Local device camera not available, falling back to backend stream:', camErr);
    }

    // Fallback to Backend MJPEG Stream
    setUseLocalCam(false);
    setFaceFeedUrl(feedUrl);
    setScanStatus('Webcam Active. Align Face...');

    const interval = setInterval(async () => {
      try {
        const res = await fetch(checkUrl);
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'success' && data.username) {
            clearInterval(interval);
            setScanState('success');
            setScanStatus(`Access Granted! Welcome ${data.username}`);

            if (data.access) {
              localStorage.setItem('access_token', data.access);
            }
            if (data.refresh) {
              localStorage.setItem('refresh_token', data.refresh);
            }
            const authenticatedUser = data.user || { username: data.username, is_staff: true };
            localStorage.setItem('user', JSON.stringify(authenticatedUser));
            if (setUser) setUser(authenticatedUser);

            if (window.showToast) {
              window.showToast(`Welcome back, ${data.username}! Access Granted.`, 'success', 'WELCOME');
            }

            setTimeout(() => {
              stopFaceLogin();
              setActivePage('home');
            }, 1200);
          }
        }
      } catch (err) {
        console.error('Face check error:', err);
      }
    }, 800);

    setFaceCheckInterval(interval);
  };

  return (
    <>

      <div className="w-100 flex-grow-1 d-flex flex-column justify-content-center position-relative overflow-hidden py-5" style={{ minHeight: 'calc(100vh - 140px)' }}>
        <div className="page-hero-bg-wrapper full-page">
          <div className="page-hero-bg"></div>
          <div className="page-hero-orb"></div>
        </div>
        <div className="container position-relative" style={{ zIndex: 1 }}>
          <div className="row justify-content-center">
            <div className="col-11 col-md-6 col-lg-4">
              <div className="login-card p-4 p-md-5 rounded-5 position-relative overflow-hidden" data-reveal="true" style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-color)',
                boxShadow: 'var(--shadow-lg)',
              }}>

                <div className="position-absolute top-0 start-50 translate-middle"
                  style={{ width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(13, 110, 253, 0.18) 0%, rgba(6, 182, 212, 0.06) 50%, transparent 70%)', zIndex: -1 }}>
                </div>

                <div className="mb-4 text-center mt-3">
                  <div className="shield-icon-wrap mx-auto mb-3">
                    <i className="bi bi-shield-lock-fill text-primary" style={{ fontSize: '2rem' }}></i>
                  </div>
                  <h2 className="fw-bold mb-1" style={{ fontSize: '1.7rem', letterSpacing: '-0.02em', color: 'var(--text-heading)' }}>Welcome Back</h2>
                  <p className="small" style={{ color: 'var(--text-secondary)' }}>Access the Smart Sight dashboard</p>
                </div>

                <form onSubmit={handleLogin} className="needs-validation">
                  <div className="mb-3">
                    <div className="form-floating custom-form-floating">
                      <input type="text" className="form-control" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} required />
                      <label style={{ color: 'var(--form-label)' }}>Username</label>
                    </div>
                  </div>

                  <div className="mb-3">
                    <div className="form-floating custom-form-floating position-relative">
                      <input type={showPassword ? "text" : "password"} className="form-control pe-5" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
                      <label style={{ color: 'var(--form-label)' }}>Password</label>
                      <button type="button" className="btn position-absolute top-50 end-0 translate-middle-y border-0 hover-glow" onClick={() => setShowPassword(!showPassword)} style={{ background: 'transparent', zIndex: 10, paddingRight: '1.25rem', color: 'var(--text-secondary)' }}>
                        <i className={`bi ${showPassword ? 'bi-eye' : 'bi-eye-slash'}`}></i>
                      </button>
                    </div>
                  </div>

                  <div className={`d-flex justify-content-end ${error ? 'mb-2' : 'mb-4'}`}>
                    <a href="#" className="small text-primary text-decoration-none fw-semibold py-1" onClick={(e) => { e.preventDefault(); setActivePage('forgot_password'); }}>Forgot Password?</a>
                  </div>

                  {error && (
                    <div className="alert alert-danger border-0 bg-danger bg-opacity-10 text-danger small mb-4 rounded-3 d-flex align-items-center" role="alert">
                      <i className="bi bi-exclamation-triangle-fill me-2"></i> {error}
                    </div>
                  )}

                  <button type="submit" className="btn-auth-primary">
                    <i className="bi bi-box-arrow-in-right" style={{ fontSize: '1.05rem' }}></i>
                    <span>Login</span>
                  </button>
                </form>

                <div className="d-flex align-items-center my-3">
                  <hr className="flex-grow-1" style={{ borderColor: 'var(--border-color)', opacity: 0.5 }} />
                  <span className="mx-3 small fw-bold" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>OR</span>
                  <hr className="flex-grow-1" style={{ borderColor: 'var(--border-color)', opacity: 0.5 }} />
                </div>

                <button 
                  type="button" 
                  className="btn w-100 d-flex align-items-center justify-content-center gap-2 hover-glow" 
                  onClick={startFaceLogin} 
                  style={{ 
                    height: '46px', 
                    minHeight: '46px',
                    width: '100%',
                    maxWidth: '220px',
                    margin: '0 auto',
                    boxSizing: 'border-box',
                    borderRadius: '999px', 
                    border: '1.5px solid var(--border-color)', 
                    background: 'var(--bg-surface-solid)', 
                    color: 'var(--text-heading)',
                    fontWeight: 600,
                    fontSize: '0.92rem',
                    boxShadow: 'var(--shadow-xs)'
                  }}
                >
                  <i className="bi bi-person-bounding-box text-primary" style={{ fontSize: '1.05rem' }}></i>
                  <span>Login with Face</span>
                </button>

                <div className="text-center mt-4">
                  <p className="opacity-50 x-small mb-0" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Encryption active. System activity is logged.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Biometric Face Scanner Modal */}
      {showFaceModal && (
        <>
          <div className="modal-backdrop fade show modern-backdrop" style={{ opacity: 0.7, }}></div>
          <div className="modal fade show d-block" tabIndex="-1" data-bs-backdrop="static" data-bs-keyboard="false" aria-hidden="true">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content overflow-hidden" style={{
                background: 'var(--modal-bg)',
                border: `1px solid ${scanState === 'success' ? 'rgba(25, 135, 84, 0.8)' : 'rgba(13, 110, 253, 0.25)'}`,
                borderRadius: '24px',
                boxShadow: scanState === 'success' ? '0 0 50px rgba(25, 135, 84, 0.4)' : '0 0 40px rgba(13, 110, 253, 0.15)',
                transition: 'border-color 0.5s ease, box-shadow 0.5s ease'
              }}>

                <div className="modal-header border-0 p-4 pb-0 d-flex justify-content-between align-items-center">
                  <h5 className="modal-title fw-bold d-flex align-items-center gap-2" style={{ color: 'var(--text-heading)' }}>
                    <i className="bi bi-cpu text-primary animate-pulse"></i>
                    <span>BIOMETRIC SCANNER</span>
                  </h5>
                  <button type="button" className="btn-close opacity-50 hover-glow" onClick={stopFaceLogin}></button>
                </div>

                <div className="modal-body p-4 text-center">
                  <p className="small mb-4" style={{ color: 'var(--text-secondary)' }}>Smart Sight Admin Biometric Authentication</p>

                  <div className="position-relative mx-auto mb-4 overflow-hidden rounded-4 border"
                    style={{ width: '100%', maxWidth: '300px', aspectRatio: '1/1', background: '#000', borderColor: 'var(--border-color) !important' }}>

                    {/* Real Webcam Stream Feed */}
                    {useLocalCam ? (
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-100 h-100 object-fit-cover"
                      />
                    ) : faceFeedUrl ? (
                      <img
                        ref={faceFeedRef}
                        src={faceFeedUrl}
                        alt="Biometric Face Scanner Stream"
                        className="w-100 h-100 object-fit-cover"
                        onError={() => setScanStatus('Backend stream offline. Using device sensor...')}
                      />
                    ) : (
                      <div className="w-100 h-100 object-fit-cover d-flex align-items-center justify-content-center text-secondary">
                        Initializing Camera Stream...
                      </div>
                    )}

                    {/* Biometric HUD Overlays */}
                    <div className="biometric-overlay position-absolute inset-0 d-flex flex-column justify-content-between p-4 pointer-events-none">
                      <div className="d-flex justify-content-between">
                        <div className="hud-corner top-left"></div>
                        <div className="hud-corner top-right"></div>
                      </div>

                      <div className="hud-target-ring position-absolute top-50 start-50 translate-middle rounded-circle border border-primary opacity-50"
                        style={{ width: '220px', height: '220px', borderWidth: '2px !important', borderStyle: 'dashed !important', animation: 'spin 15s linear infinite' }}>
                      </div>

                      <div className="hud-target-inner position-absolute top-50 start-50 translate-middle rounded-circle border border-primary border-opacity-25"
                        style={{ width: '170px', height: '170px' }}>
                      </div>

                      <div className="hud-laser position-absolute w-100 left-0 bg-primary opacity-75"
                        style={{ height: '3px', boxShadow: '0 0 12px #2563eb', animation: 'scanLine 3s ease-in-out infinite' }}>
                      </div>

                      <div className="d-flex justify-content-between">
                        <div className="hud-corner bottom-left"></div>
                        <div className="hud-corner bottom-right"></div>
                      </div>
                    </div>

                    {/* Success Overlay */}
                    <div className={`position-absolute inset-0 d-flex flex-column align-items-center justify-content-center bg-black bg-opacity-75 transition-all pointer-events-none ${scanState === 'success' ? 'opacity-100' : 'opacity-0'}`} style={{ zIndex: 10 }}>
                      <div className="success-ring rounded-circle bg-success bg-opacity-10 border border-success d-flex align-items-center justify-content-center mb-3" style={{ width: '80px', height: '80px', borderWidth: '2px !important' }}>
                        <i className={`bi bi-shield-check text-success fs-1 ${scanState === 'success' ? 'animate-scale' : ''}`}></i>
                      </div>
                      <h5 className="text-success fw-bold mb-1">IDENTITY VERIFIED</h5>
                      <p className="small mb-0" style={{ color: 'var(--text-secondary)' }}>Access Granted</p>
                    </div>
                  </div>

                  <div className="hud-status-wrapper py-2 mb-3">
                    <span className={`badge rounded-pill bg-opacity-10 border border-opacity-25 px-4 py-2 fs-6 fw-semibold d-inline-flex align-items-center gap-2 ${scanState === 'success' ? 'bg-success text-success border-success' : 'bg-primary text-primary border-primary'}`}>
                      {scanState === 'scanning' && <span className="spinner-grow spinner-grow-sm text-primary" role="status" aria-hidden="true"></span>}
                      <span>{scanStatus}</span>
                    </span>
                  </div>
                </div>

                <div className="modal-footer border-0 p-4 pt-0 justify-content-center">
                  <p className="opacity-50 x-small mb-0" style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                    Smart Sight Secure Biometric Core v2.0 • Restricted Area
                  </p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
