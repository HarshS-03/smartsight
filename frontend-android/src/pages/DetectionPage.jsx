import React, { useEffect, useState, useRef } from 'react';
import API from '../api/axios';

const MODEL_LABELS = {
  'yolo26n_face_onnx': 'YOLOv26 Face (ONNX)',
  'yolo26n_face_pt': 'YOLOv26 Face (PyTorch)',
  'yolov8n_face_onnx': 'YOLOv8 Face (ONNX)',
  'yolov8n_face_pt': 'YOLOv8 Face (PyTorch)',
  'yolov8n_onnx': 'YOLOv8 Nano (ONNX)',
  'yolov8n_pt': 'YOLOv8 Nano (PyTorch)',
  'yolov8s_onnx': 'YOLOv8 Small (ONNX)',
  'yolov8s': 'YOLOv8 Small (PyTorch)',
};

export default function DetectionPage() {
  const [cameras, setCameras] = useState([]); // Loaded from API
  const [viewMode, setViewMode] = useState('single');
  const [modelType, setModelType] = useState('yolo26n_face_onnx');
  const [cameraType, setCameraType] = useState('0');
  const [cameraUrl, setCameraUrl] = useState('');

  const [isFeedRunning, setIsFeedRunning] = useState(false);
  const [feedUrl, setFeedUrl] = useState('');
  const [feedError, setFeedError] = useState(false);
  const [isDetectionsMinimized, setIsDetectionsMinimized] = useState(false);
  const [stats, setStats] = useState({ fps: 0.0, faces: 0, names: [], resolution: '' });

  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [cameraDropdownOpen, setCameraDropdownOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const liveFeedRef = useRef(null);
  const localVideoRef = useRef(null);
  const localCanvasRef = useRef(null);
  const loopIntervalRef = useRef(null);
  const localStreamRef = useRef(null);

  const handleModelChange = async (newModel) => {
    if (newModel === modelType) {
      setModelDropdownOpen(false);
      return;
    }
    setModelType(newModel);
    setModelDropdownOpen(false);

    const label = MODEL_LABELS[newModel] || newModel;
    if (window.showToast) {
      window.showToast(`Detection Model switched to ${label}`, 'success', 'MODEL SWITCHED');
    }

    if (isFeedRunning) {
      const baseUrl = getBackendBaseUrl();
      const newSrc = `${baseUrl}/video_feed/?src=${cameraType === 'url' ? encodeURIComponent(cameraUrl) : cameraType}&model=${newModel}&stats_key=${cameraType}&t=${Date.now()}`;
      setFeedUrl(newSrc);
      if (liveFeedRef.current) {
        liveFeedRef.current.src = newSrc;
      }
      try {
        await API.post('/start_video_feed/', { src: cameraType, model: newModel });
      } catch (e) {
        console.warn('Error updating live feed model:', e);
      }
    } else {
      // Just log it in backend so user can see it in terminal even when stopped
      try {
        await API.post('/set_model/', { src: cameraType, model: newModel });
      } catch (e) {
        console.warn('Error syncing model choice:', e);
      }
    }
  };

  const getBackendBaseUrl = () => {
    // 1. Check if user configured a custom IP in the mobile app settings (e.g. 192.168.1.10:8000)
    const savedIp = localStorage.getItem('server_ip');
    if (savedIp) {
      const cleanIp = savedIp.trim().replace(/\/+$/, '');
      const formattedIp = cleanIp.startsWith('http') ? cleanIp : `http://${cleanIp}`;
      return formattedIp.replace(/\/api\/?$/, '');
    }
    // 2. If running in mobile browser connected via Wi-Fi IP
    if (typeof window !== 'undefined' && window.location && window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      return `${window.location.protocol}//${window.location.hostname}:8000`;
    }
    // 3. Fallback
    return (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api').replace(/\/api\/?$/, '');
  };

  useEffect(() => {
    const fetchCameras = async () => {
      try {
        const res = await API.get('/cameras/');
        if (res.data && Array.isArray(res.data)) {
          setCameras(res.data);
        }
      } catch (err) {
        console.error('Error fetching cameras:', err);
      }
    };
    fetchCameras();
  }, []);

  useEffect(() => {
    // Reveal logic
    const revealEls = document.querySelectorAll('[data-reveal]');
    if (revealEls.length > 0) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const delay = entry.target.getAttribute('data-reveal-delay') || 0;
            setTimeout(() => {
              entry.target.classList.add('is-visible');
            }, parseInt(delay, 10));
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

      revealEls.forEach(el => observer.observe(el));
    }
  }, []);

  const lastStartClickRef = useRef(0);
  const userStoppedRef = useRef(false);

  // 1. Check initial stream state once on mount / camera change
  useEffect(() => {
    let isMounted = true;
    const checkInitialState = async () => {
      try {
        const baseUrl = getBackendBaseUrl();
        const res = await fetch(`${baseUrl}/video_stats/?src=${cameraType}`);
        if (res.ok && isMounted) {
          const data = await res.json();
          if (data.is_active && data.fps > 0 && data.desired_state !== 'STOP') {
            setStats({
              fps: data.fps || 0,
              faces: data.faces || data.persons || 0,
              names: data.names || [],
              resolution: data.resolution || '640x480',
            });
            setIsFeedRunning(true);
            const activeModel = data.current_model || modelType;
            const src = `${baseUrl}/video_feed/?src=${cameraType === 'url' ? encodeURIComponent(cameraUrl) : cameraType}&model=${activeModel}&stats_key=${cameraType}`;
            setFeedUrl(src);
            if (liveFeedRef.current) {
              liveFeedRef.current.src = src;
              liveFeedRef.current.style.display = 'block';
            }
          }
        }
      } catch (e) {
        // silent
      }
    };
    checkInitialState();
    return () => { isMounted = false; };
  }, [cameraType]);

  // 2. Poll telemetry only while feed is actively running
  useEffect(() => {
    if (!isFeedRunning) return;

    const intervalId = setInterval(async () => {
      if (document.hidden) return;

      try {
        const baseUrl = getBackendBaseUrl();
        const res = await fetch(`${baseUrl}/video_stats/?src=${cameraType}`);
        if (res.ok) {
          const data = await res.json();
          const active = Boolean(data.is_active && (data.fps && data.fps > 0) && data.desired_state !== 'STOP');
          const isWarmingUp = (Date.now() - lastStartClickRef.current) < 10000;

          if (active && !userStoppedRef.current) {
            setStats({
              fps: data.fps || 0,
              faces: data.faces || data.persons || 0,
              names: data.names || [],
              resolution: data.resolution || '640x480',
            });
          } else if (!active && !isWarmingUp) {
            userStoppedRef.current = false;
            setIsFeedRunning(false);
            setFeedUrl('');
            setStats({ fps: 0.0, faces: 0, names: [], resolution: '0x0' });
            if (liveFeedRef.current) {
              liveFeedRef.current.style.display = 'none';
              liveFeedRef.current.removeAttribute('src');
              liveFeedRef.current.src = '';
            }
          }
        }
      } catch (e) {
        // silent catch
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, [isFeedRunning, cameraType]);

  const handleStartFeed = async () => {
    lastStartClickRef.current = Date.now();
    userStoppedRef.current = false;
    setFeedError(false);
    setIsFeedRunning(true);
    
    if (cameraType === '1') {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        
        loopIntervalRef.current = setInterval(async () => {
          if (!localVideoRef.current || !localCanvasRef.current || userStoppedRef.current) return;
          if (localVideoRef.current.videoWidth === 0) return;
          
          const ctx = localCanvasRef.current.getContext('2d');
          localCanvasRef.current.width = localVideoRef.current.videoWidth;
          localCanvasRef.current.height = localVideoRef.current.videoHeight;
          ctx.drawImage(localVideoRef.current, 0, 0);
          
          const base64Img = localCanvasRef.current.toDataURL('image/jpeg', 0.6);
          try {
            const res = await API.post('/process_client_frame/', {
              image: base64Img,
              model: modelType,
              orientation: 'normal'
            });
            if (res.data && res.data.status === 'success') {
               setFeedUrl(res.data.image);
               if (liveFeedRef.current) {
                 liveFeedRef.current.src = res.data.image;
                 liveFeedRef.current.style.display = 'block';
               }
               setStats(prev => ({ ...prev, faces: res.data.faces || 0, fps: res.data.fps || 5.0 }));
            }
          } catch (e) {
             // ignore
          }
        }, 200); // 5 FPS
      } catch (err) {
        setFeedError(true);
        setIsFeedRunning(false);
        console.error('Error accessing local camera:', err);
      }
    } else {
      const baseUrl = getBackendBaseUrl();
      const src = `${baseUrl}/video_feed/?src=${cameraType === 'url' ? encodeURIComponent(cameraUrl) : cameraType}&model=${modelType}&stats_key=${cameraType}&t=${Date.now()}`;
      setFeedUrl(src);
      if (liveFeedRef.current) {
        liveFeedRef.current.src = src;
        liveFeedRef.current.style.display = 'block';
      }
      try {
        await API.post('/start_video_feed/', { src: cameraType, model: modelType });
      } catch (e) {
        console.warn('Error sending start_video_feed command:', e);
      }
    }
  };

  const handleStopFeed = async () => {
    lastStartClickRef.current = 0;
    userStoppedRef.current = true;
    setIsFeedRunning(false);
    setFeedError(false);
    setFeedUrl('');
    setStats({ fps: 0.0, faces: 0, names: [], resolution: '0x0' });
    if (liveFeedRef.current) {
      liveFeedRef.current.style.display = 'none';
      liveFeedRef.current.removeAttribute('src');
      liveFeedRef.current.src = '';
    }
    
    if (cameraType === '1') {
      if (loopIntervalRef.current) clearInterval(loopIntervalRef.current);
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
      }
    } else {
      try {
        await API.post('/stop_video_feed/', { src: cameraType });
      } catch (e) {
        console.warn('Error sending stop_video_feed command:', e);
      }
    }
  };

  return (
    <>
      {/* ── Page Hero ────────────────────────────────────────── */}
      <section className="page-hero text-center" style={{ paddingTop: '1rem', paddingBottom: '0.5rem' }}>
        <div className="page-hero-bg-wrapper">
          <div className="page-hero-bg"></div>
          <div className="page-hero-orb"></div>
        </div>

        <div className="container page-hero-content" style={{ zIndex: 2 }}>
          <div className="row justify-content-center text-center mb-0">
            <div className="col-lg-8 col-md-10 mx-auto">
              <h1 className="detect-title mb-1 text-center" style={{ fontSize: '2rem' }}>
                Live <span className="accent">Detection</span>
              </h1>
              <p className="page-hero-sub mx-auto mb-0" data-reveal="true" data-reveal-delay="120" style={{ fontSize: '0.85rem' }}>
                Real-time AI Face Detection & Recognition.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Detection Console ─────────────────────────────────── */}
      {/* ── Detection Console ─────────────────────────────────── */}
      <div className="container-fluid px-lg-4 pb-5">
        <div className="row justify-content-center">
          <div className="col-12 col-xl-11">
            <div className="video-panel">

              {/* Controls View Mode and Model selectors */}
              <div className="row mb-4 g-3 align-items-stretch">
                {/* Right: Model Selection (Now Full Width) */}
                <div className="col-12">
                  {/* Model Selector Card */}
                  <div className="detection-control-card h-100 d-flex flex-column justify-content-center p-3"
                    style={{ position: 'relative', zIndex: modelDropdownOpen ? 100 : 2 }}>
                    <div className="d-flex align-items-center gap-2 mb-2">
                      <i className="bi bi-cpu text-primary"></i>
                      <span className="fw-semibold text-heading" style={{ fontSize: '0.92rem' }}>AI Model Engine</span>
                    </div>
                    <div className="custom-dropdown w-100" onClick={() => { setModelDropdownOpen(!modelDropdownOpen); setCameraDropdownOpen(false); }}>
                      <div className="dropdown-selected-rect w-100">
                        <span className="text-truncate me-2 fw-semibold">
                          {modelType === 'yolo26n_face_onnx' && 'YOLOv26 Face (ONNX)'}
                          {modelType === 'yolo26n_face_pt' && 'YOLOv26 Face (PyTorch)'}
                          {modelType === 'yolov8n_face_onnx' && 'YOLOv8 Face (ONNX)'}
                          {modelType === 'yolov8n_face_pt' && 'YOLOv8 Face (PyTorch)'}
                          {modelType === 'yolov8n_onnx' && 'YOLOv8 Nano (ONNX)'}
                          {modelType === 'yolov8n_pt' && 'YOLOv8 Nano (PyTorch)'}
                          {modelType === 'yolov8s_onnx' && 'YOLOv8 Small (ONNX)'}
                          {modelType === 'yolov8s' && 'YOLOv8 Small (PyTorch)'}
                        </span>
                        <i className="bi bi-chevron-down small opacity-50 flex-shrink-0 ms-auto"></i>
                      </div>
                      <div className={`dropdown-options ${modelDropdownOpen ? 'open' : ''}`}>
                        <div className={`dropdown-option ${modelType === 'yolo26n_face_onnx' ? 'active' : ''}`} onClick={() => handleModelChange('yolo26n_face_onnx')}>
                          <div className="fw-semibold">YOLOv26 Face (ONNX)</div>
                          <div className="small text-muted" style={{ fontSize: '0.72rem', marginTop: '2px' }}>Next-Gen Precision Engine • 30+ FPS (Recommended)</div>
                        </div>
                        <div className={`dropdown-option ${modelType === 'yolo26n_face_pt' ? 'active' : ''}`} onClick={() => handleModelChange('yolo26n_face_pt')}>
                          <div className="fw-semibold">YOLOv26 Face (PyTorch)</div>
                          <div className="small text-muted" style={{ fontSize: '0.72rem', marginTop: '2px' }}>Next-Gen Max Accuracy • PyTorch</div>
                        </div>
                        <div className={`dropdown-option ${modelType === 'yolov8n_face_onnx' ? 'active' : ''}`} onClick={() => handleModelChange('yolov8n_face_onnx')}>
                          <div className="fw-semibold">YOLOv8 Face (ONNX)</div>
                          <div className="small text-muted" style={{ fontSize: '0.72rem', marginTop: '2px' }}>Legacy Precision Engine • High FPS</div>
                        </div>
                        <div className={`dropdown-option ${modelType === 'yolov8n_face_pt' ? 'active' : ''}`} onClick={() => handleModelChange('yolov8n_face_pt')}>
                          <div className="fw-semibold">YOLOv8 Face (PyTorch)</div>
                          <div className="small text-muted" style={{ fontSize: '0.72rem', marginTop: '2px' }}>Legacy Max Accuracy • PyTorch</div>
                        </div>
                        <div className={`dropdown-option ${modelType === 'yolov8n_onnx' ? 'active' : ''}`} onClick={() => handleModelChange('yolov8n_onnx')}>
                          <div className="fw-semibold">YOLOv8 Nano (ONNX)</div>
                          <div className="small text-muted" style={{ fontSize: '0.72rem', marginTop: '2px' }}>Ultra Fast • High FPS</div>
                        </div>
                        <div className={`dropdown-option ${modelType === 'yolov8n_pt' ? 'active' : ''}`} onClick={() => handleModelChange('yolov8n_pt')}>
                          <div className="fw-semibold">YOLOv8 Nano (PyTorch)</div>
                          <div className="small text-muted" style={{ fontSize: '0.72rem', marginTop: '2px' }}>Fast • Standard PyTorch Format</div>
                        </div>
                        <div className={`dropdown-option ${modelType === 'yolov8s_onnx' ? 'active' : ''}`} onClick={() => handleModelChange('yolov8s_onnx')}>
                          <div className="fw-semibold">YOLOv8 Small (ONNX)</div>
                          <div className="small text-muted" style={{ fontSize: '0.72rem', marginTop: '2px' }}>Higher Accuracy • ONNX Engine</div>
                        </div>
                        <div className={`dropdown-option ${modelType === 'yolov8s' ? 'active' : ''}`} onClick={() => handleModelChange('yolov8s')}>
                          <div className="fw-semibold">YOLOv8 Small (PyTorch)</div>
                          <div className="small text-muted" style={{ fontSize: '0.72rem', marginTop: '2px' }}>Max Accuracy • PyTorch Format</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Main Surveillance Layout: LEFT = Viewport, RIGHT = Vertical Panel ── */}
              <div className="row g-4 align-items-stretch">
                {/* LEFT: Camera Viewport */}
                <div className="col-12 col-lg-8 col-xl-8 col-xxl-9 d-flex flex-column">
                  {/* Single Video feed Panel */}
                  {viewMode === 'single' && (
                    <div id="video-feed-container" className={`w-100 d-flex align-items-center justify-content-center flex-grow-1 ${isFeedRunning ? 'feed-active' : ''}`} style={{ margin: 0 }}>
                      {/* HUD Corners */}
                      <div className="vid-hud-corner vid-hud-tl"></div>
                      <div className="vid-hud-corner vid-hud-tr"></div>
                      <div className="vid-hud-corner vid-hud-bl"></div>
                      <div className="vid-hud-corner vid-hud-br"></div>

                      {/* Offline placeholder */}
                      {!isFeedRunning && (
                        <div className="text-center text-secondary">
                          <i className="bi bi-camera-video-off display-4 mb-3 d-block" style={{ opacity: .35 }}></i>
                          <h5 className="fw-bold text-white mb-1">Camera Offline</h5>
                          <p className="small text-muted mb-0">Click <strong>Start Feed</strong> to begin monitoring.</p>
                        </div>
                      )}

                      {/* Error placeholder */}
                      {isFeedRunning && feedError && (
                        <div className="text-center text-secondary p-4">
                          <i className="bi bi-exclamation-triangle-fill text-warning display-4 mb-3 d-block" style={{ opacity: .8 }}></i>
                          <h5 className="fw-bold text-white mb-1">Stream Signal Error</h5>
                          <p className="small text-muted mb-0">Could not connect to stream feed or camera is offline.</p>
                        </div>
                      )}

                      <img
                        ref={liveFeedRef}
                        src={isFeedRunning ? feedUrl : ''}
                        alt=""
                        className="w-100 h-100"
                        style={{ display: isFeedRunning && !feedError ? 'block' : 'none' }}
                        onLoad={() => setFeedError(false)}
                        onError={() => {
                          if (isFeedRunning) setFeedError(true);
                        }}
                      />
                    </div>
                  )}

                  {/* Multi-Camera Grid Container */}
                  {viewMode === 'grid' && (() => {
                    const gridCameras = cameras.length > 0
                      ? (cameras.some(c => String(c.id) === '0') ? cameras : [{ id: '0', name: 'Default Webcam' }, ...cameras])
                      : [{ id: '0', name: 'Default Webcam' }];

                    return (
                      <div className="row row-cols-1 row-cols-md-2 g-3">
                        {gridCameras.map(camera => (
                          <div className="col" key={camera.id}>
                            <div className="p-3 rounded-4"
                              style={{ background: 'var(--bg-surface-solid)', border: `1px solid ${isFeedRunning ? 'rgba(34, 197, 94, 0.4)' : 'var(--border-subtle)'}`, position: 'relative', overflow: 'hidden', boxShadow: 'var(--shadow-sm)', transition: 'border-color 0.4s ease' }}>

                              {/* Card Header */}
                              <div className="d-flex justify-content-between align-items-center mb-2">
                                <span className="fw-bold small text-uppercase"
                                  style={{ letterSpacing: '0.5px', fontSize: '0.8rem', color: 'var(--text-heading)' }}><i
                                    className="bi bi-camera-video-fill text-primary me-2"></i>{camera.name}</span>
                                <span className={`badge rounded-pill px-2.5 py-1 status-badge-indicator ${isFeedRunning ? 'badge-active' : 'badge-inactive'}`}
                                  style={{ fontSize: '0.65rem' }}>{isFeedRunning ? 'Online' : 'Offline'}</span>
                              </div>

                              {/* Video Frame */}
                              <div
                                className="position-relative overflow-hidden rounded-3 mb-2 bg-black d-flex align-items-center justify-content-center"
                                style={{ aspectRatio: '16/9', border: '1px solid var(--border-subtle)' }}>
                                {!isFeedRunning && (
                                  <div className="text-center py-4">
                                    <i className="bi bi-camera-video-off display-6 mb-2 d-block text-secondary" style={{ opacity: .5 }}></i>
                                    <p className="small mb-0 text-secondary font-mono" style={{ fontSize: '0.75rem' }}>Feed Stopped</p>
                                  </div>
                                )}
                                <img
                                  src={isFeedRunning ? `${getBackendBaseUrl()}/video_feed/?src=${camera.id}&model=${modelType}&stats_key=${camera.id}&t=${Date.now()}` : ''}
                                  alt={camera.name}
                                  className="w-100 h-100"
                                  style={{ objectFit: 'cover', display: isFeedRunning ? 'block' : 'none' }}
                                  decoding="async"
                                />
                              </div>

                              {/* Card Stats/Actions Footer */}
                              <div className="d-flex justify-content-between align-items-center">
                                <div className="d-flex gap-3 font-mono" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                  <div>
                                    <span className="fw-bold" style={{ color: 'var(--text-heading)' }}>{isFeedRunning ? (stats.fps || '0.0') : '0.0'}</span> <span className="opacity-75"
                                      style={{ fontSize: '0.68rem' }}>FPS</span>
                                  </div>
                                  <div>
                                    <span className="fw-bold" style={{ color: 'var(--text-heading)' }}>{isFeedRunning ? (stats.faces || 0) : 0}</span> <span className="opacity-75"
                                      style={{ fontSize: '0.68rem' }}>Faces</span>
                                  </div>
                                </div>
                                <div className="d-flex gap-2">
                                  <button className="btn btn-sm rounded-pill px-2.5 py-1 fw-bold grid-maximize-btn"
                                    style={{ fontSize: '0.72rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-heading)' }} onClick={() => { setViewMode('single'); setCameraType(camera.id); }}>
                                    <i className="bi bi-arrows-angle-expand me-1 text-primary"></i> Maximize
                                  </button>
                                </div>
                              </div>

                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>


                {/* RIGHT: Premium Command Panel */}
                <div className="col-12 col-lg-4 col-xl-4 col-xxl-3">
                  <div className="cp-wrap" style={{ position: 'relative', zIndex: cameraDropdownOpen ? 90 : 1 }}>
                    <div className="cp-panel">

                      {/* ── Top Strip: Source + Status pill ── */}
                      <div className="cp-top-strip">
                        <div className="cp-top-left">
                          <span className="cp-top-eyebrow">
                            <i className="bi bi-camera-video"></i> ACTIVE SOURCE
                          </span>
                          <div className={`cp-status-pill ${isFeedRunning ? 'live' : 'idle'}`}>
                            <span className="cp-status-dot"></span>
                            {isFeedRunning ? 'LIVE' : 'IDLE'}
                          </div>
                        </div>
                      </div>

                      {/* ── Camera Selector ── */}
                      {viewMode === 'single' ? (
                        <div className="cp-cam-block">
                          <div
                            className="cp-cam-selector"
                            onClick={() => { setCameraDropdownOpen(!cameraDropdownOpen); setModelDropdownOpen(false); }}
                          >
                            <div className={`cp-cam-icon-wrap ${isFeedRunning ? 'live' : 'offline'}`}>
                              <i className="bi bi-camera-video-fill"></i>
                              <span className={`cp-cam-dot ${isFeedRunning ? 'on' : ''}`}></span>
                            </div>
                            <div className="cp-cam-details">
                              <span className="cp-cam-name">
                                {cameraType === '0' && 'Default Webcam'}
                                {cameraType === '1' && 'Back Camera'}
                                {cameras.find(c => c.id === cameraType)?.name}
                              </span>
                              <span className="cp-cam-sub">
                                {isFeedRunning ? (stats.resolution && stats.resolution !== '0x0' ? stats.resolution : '640×480') : 'Click to switch source'}
                              </span>
                            </div>
                            <i className={`bi bi-chevron-down cp-cam-chevron ${cameraDropdownOpen ? 'open' : ''}`}></i>
                          </div>
                          <div className={`dropdown-options ${cameraDropdownOpen ? 'open' : ''}`}>
                            {cameras.map((camera) => (
                              <div key={camera.id} className={`dropdown-option ${cameraType === camera.id ? 'active' : ''}`} onClick={() => setCameraType(camera.id)}>{camera.name}</div>
                            ))}
                            {cameras.length === 0 && (
                              <>
                                <div className={`dropdown-option ${cameraType === '0' ? 'active' : ''}`} onClick={() => setCameraType('0')}>Default Webcam</div>
                                <div className={`dropdown-option ${cameraType === '1' ? 'active' : ''}`} onClick={() => setCameraType('1')}>Back Camera</div>
                              </>
                            )}
                            {cameras.length > 0 && !cameras.some(c => String(c.id) === '1') && (
                              <div className={`dropdown-option ${cameraType === '1' ? 'active' : ''}`} onClick={() => setCameraType('1')}>Back Camera</div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="cp-grid-badge">
                          <i className="bi bi-grid-3x3-gap-fill"></i>
                          <span>Multi-Camera Grid Active</span>
                        </div>
                      )}

                      {/* ── Divider ── */}
                      <div className="cp-rule">
                        <span className="cp-rule-label"><i className="bi bi-activity"></i> TELEMETRY</span>
                        <span className="cp-rule-line"></span>
                      </div>

                      {/* ── Stream Status Banner ── */}
                      <div className={`cp-stream-banner ${isFeedRunning ? 'live' : 'offline'}`}>
                        <div className="cp-stream-icon">
                          {isFeedRunning ? (
                            <>
                              <i className="bi bi-broadcast"></i>
                              <span className="cp-ring"></span>
                            </>
                          ) : (
                            <i className="bi bi-slash-circle"></i>
                          )}
                        </div>
                        <div className="cp-stream-text">
                          <span className="cp-stream-status-label">STREAM STATUS</span>
                          <span className={`cp-stream-status-val ${isFeedRunning ? 'live' : 'off'}`}>
                            {isFeedRunning ? 'Live' : 'Offline'}
                          </span>
                        </div>
                      </div>

                      {/* ── Metrics Row ── */}
                      <div className="cp-metrics">
                        {/* FPS */}
                        <div className="cp-metric">
                          <div className="cp-metric-top">
                            <div className="cp-metric-icon blue"><i className="bi bi-speedometer2"></i></div>
                            <span className="cp-metric-tag blue">FPS</span>
                          </div>
                          <span className={`cp-metric-num ${isFeedRunning ? 'blue' : ''}`}>
                            {isFeedRunning ? (stats.fps || '0.0') : '0.0'}
                          </span>
                          <span className="cp-metric-label">FRAMERATE</span>
                          <div className="cp-bar-track">
                            <div className="cp-bar-fill blue" style={{ width: isFeedRunning ? `${Math.min(100, (parseFloat(stats.fps) || 0) / 60 * 100)}%` : '0%' }}></div>
                          </div>
                        </div>

                        {/* Detections */}
                        <div className="cp-metric">
                          <div className="cp-metric-top">
                            <div className={`cp-metric-icon ${isFeedRunning && stats.faces > 0 ? 'green' : 'dim'}`}><i className="bi bi-person-bounding-box"></i></div>
                            <span className={`cp-metric-tag ${isFeedRunning && stats.faces > 0 ? 'green' : 'dim'}`}>
                              {isFeedRunning && stats.faces > 0 ? 'ACTIVE' : 'IDLE'}
                            </span>
                          </div>
                          <span className={`cp-metric-num ${isFeedRunning && stats.faces > 0 ? 'green' : ''}`}>
                            {isFeedRunning ? (stats.faces || 0) : 0}
                          </span>
                          <span className="cp-metric-label">DETECTIONS</span>
                          <div className="cp-bar-track">
                            <div className={`cp-bar-fill ${isFeedRunning && stats.faces > 0 ? 'green' : 'dim'}`} style={{ width: isFeedRunning ? `${Math.min(100, (stats.faces || 0) * 20)}%` : '0%' }}></div>
                          </div>
                        </div>
                      </div>

                      {/* ── Divider ── */}
                      <div className="cp-rule">
                        <span className="cp-rule-label"><i className="bi bi-sliders"></i> CONTROLS</span>
                        <span className="cp-rule-line"></span>
                      </div>

                      {/* ── Action Buttons (Segmented Switch matching Camera View) ── */}
                      <div className="segmented-view-switch cp-segmented-switch">
                        <button
                          type="button"
                          onClick={(e) => { e.currentTarget.blur(); handleStartFeed(); }}
                          className={`segmented-switch-btn cp-toggle-start ${isFeedRunning ? 'active' : ''}`}
                          title="Start live video detection feed"
                        >
                          <i className={isFeedRunning ? "bi bi-broadcast" : "bi bi-play-fill"}></i>
                          <span>{isFeedRunning ? 'Streaming' : 'Start Feed'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.currentTarget.blur(); handleStopFeed(); }}
                          className={`segmented-switch-btn cp-toggle-stop ${!isFeedRunning ? 'active' : ''}`}
                          title="Stop video detection feed"
                        >
                          <i className="bi bi-stop-fill"></i>
                          <span>Stop Feed</span>
                        </button>
                      </div>

                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Redesigned Live Detections HUD Panel */}
            <div className="video-panel mt-3" style={{ display: isFeedRunning ? 'block' : 'none' }}>
              {/* Card Header */}
              <div className="d-flex justify-content-between align-items-center mb-3 pb-2.5" style={{ borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))' }}>
                <div className="d-flex align-items-center gap-2.5 min-w-0">
                  <div className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: '34px', height: '34px', background: 'rgba(37, 99, 235, 0.12)', border: '1px solid rgba(37, 99, 235, 0.25)', color: '#2563eb' }}>
                    <i className="bi bi-radar fs-6"></i>
                  </div>
                  <div className="min-w-0">
                    <h6 className="fw-bold text-heading mb-0 text-uppercase text-truncate" style={{ letterSpacing: '0.8px', fontSize: '0.85rem' }}>
                      Live Detections
                    </h6>
                    <span className="text-secondary font-mono d-block text-truncate" style={{ fontSize: '0.7rem' }}>Real-time face telemetry</span>
                  </div>
                </div>
                <div className="d-flex align-items-center gap-2 flex-shrink-0 ms-2">
                  <span className="badge rounded-pill px-3 py-1.5 fw-bold d-inline-flex align-items-center" style={{ fontSize: '0.72rem', background: stats.names.length > 0 ? 'rgba(34, 197, 94, 0.14)' : 'rgba(100, 116, 139, 0.12)', color: stats.names.length > 0 ? '#22c55e' : '#94a3b8', border: `1px solid ${stats.names.length > 0 ? 'rgba(34, 197, 94, 0.3)' : 'rgba(100, 116, 139, 0.25)'}` }}>
                    <span className="rounded-circle flex-shrink-0" style={{ width: '6px', height: '6px', marginRight: '7px', background: stats.names.length > 0 ? '#22c55e' : '#94a3b8', boxShadow: stats.names.length > 0 ? '0 0 6px rgba(34, 197, 94, 0.8)' : 'none' }}></span>
                    <span>{stats.names.length} Active</span>
                  </span>
                  <button type="button" className="btn btn-sm text-secondary p-1 border-0 rounded-circle flex-shrink-0 d-flex align-items-center justify-content-center" onClick={() => setIsDetectionsMinimized(!isDetectionsMinimized)} style={{ width: '28px', height: '28px', background: 'var(--bg-input, #1e293b)', lineHeight: 1 }}>
                    <i className={`bi ${isDetectionsMinimized ? 'bi-chevron-down' : 'bi-chevron-up'}`} style={{ fontSize: '0.8rem' }}></i>
                  </button>
                </div>
              </div>

              {!isDetectionsMinimized && (
                <div style={{ overflowY: 'auto', maxHeight: '280px' }}>
                  {stats.names.length === 0 ? (
                    <div className="text-center py-3 text-secondary">
                      <i className="bi bi-shield-check d-block mb-1.5 fs-4 text-primary opacity-50"></i>
                      <p className="fw-semibold text-dynamic mb-1" style={{ fontSize: '0.88rem' }}>No Active Detections</p>
                      <p className="text-muted small mb-0" style={{ fontSize: '0.78rem' }}>Scanning stream feed for recognized or unknown faces...</p>
                    </div>
                  ) : (
                    <div className="d-flex flex-column gap-2.5">
                      {stats.names.map((name, i) => {
                        const isUnknown = name.toLowerCase() === 'unknown';
                        return (
                          <div
                            key={i}
                            className="d-flex align-items-center justify-content-between p-3 rounded-3"
                            style={{
                              background: isUnknown ? 'rgba(239, 68, 68, 0.07)' : 'rgba(37, 99, 235, 0.06)',
                              border: isUnknown ? '1px solid rgba(239, 68, 68, 0.28)' : '1px solid rgba(16, 185, 129, 0.25)',
                              transition: 'all 0.2s ease'
                            }}
                          >
                            <div className="d-flex align-items-center gap-3">
                              <div
                                className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                                style={{
                                  width: '38px',
                                  height: '38px',
                                  background: isUnknown ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                                  border: isUnknown ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid rgba(16, 185, 129, 0.35)',
                                  color: isUnknown ? '#f87171' : '#34d399'
                                }}
                              >
                                <i className={`bi ${isUnknown ? 'bi-shield-slash-fill' : 'bi-person-check-fill'} fs-6`}></i>
                              </div>
                              <div>
                                <span className="fw-bold d-block" style={{ color: isUnknown ? '#fca5a5' : 'var(--text-heading, #ffffff)', fontSize: '0.90rem', lineHeight: 1.2 }}>
                                  {isUnknown ? 'Unknown Person' : name}
                                </span>
                                <span className="small font-mono d-block" style={{ fontSize: '0.68rem', color: isUnknown ? 'rgba(248, 113, 113, 0.8)' : 'rgba(52, 211, 153, 0.8)', letterSpacing: '0.3px', marginTop: '2px' }}>
                                  {isUnknown ? 'Unregistered Face • High Alert' : 'Verified Identity • Match Confirmed'}
                                </span>
                              </div>
                            </div>
                            <span
                              className="badge rounded-pill px-3 py-1.5 fw-bold d-inline-flex align-items-center gap-1.5 text-nowrap"
                              style={{
                                fontSize: '0.72rem',
                                letterSpacing: '0.4px',
                                background: isUnknown ? 'rgba(239, 68, 68, 0.18)' : 'rgba(16, 185, 129, 0.18)',
                                color: isUnknown ? '#fca5a5' : '#6ee7b7',
                                border: isUnknown ? '1px solid rgba(239, 68, 68, 0.45)' : '1px solid rgba(16, 185, 129, 0.45)'
                              }}
                            >
                              <i className={`bi ${isUnknown ? 'bi-exclamation-octagon-fill' : 'bi-shield-fill-check'}`} style={{ fontSize: '0.74rem' }}></i>
                              <span>{isUnknown ? 'UNKNOWN INTRUDER' : 'VERIFIED PERSON'}</span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Hidden elements for native phone camera WebRTC capture */}
      <video ref={localVideoRef} autoPlay playsInline muted style={{ display: 'none' }} />
      <canvas ref={localCanvasRef} style={{ display: 'none' }} />
    </>
  );
}
