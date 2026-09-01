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
    const baseUrl = getBackendBaseUrl();
    const src = `${baseUrl}/video_feed/?src=${cameraType === 'url' ? encodeURIComponent(cameraUrl) : cameraType}&model=${modelType}&stats_key=${cameraType}&t=${Date.now()}`;
    setFeedUrl(src);
    setIsFeedRunning(true);
    if (liveFeedRef.current) {
      liveFeedRef.current.src = src;
      liveFeedRef.current.style.display = 'block';
    }
    try {
      await API.post('/start_video_feed/', { src: cameraType, model: modelType });
    } catch (e) {
      console.warn('Error sending start_video_feed command:', e);
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
    try {
      await API.post('/stop_video_feed/', { src: cameraType });
    } catch (e) {
      console.warn('Error sending stop_video_feed command:', e);
    }
  };

  return (
    <>
      {/* ── Page Hero ────────────────────────────────────────── */}
      <section className="page-hero text-center">
        <div className="page-hero-bg-wrapper">
          <div className="page-hero-bg"></div>
          <div className="page-hero-orb"></div>
        </div>

        <div className="container page-hero-content" style={{ zIndex: 2 }}>
          <div className="row justify-content-center text-center mb-2">
            <div className="col-lg-8 col-md-10 mx-auto">
              <h1 className="detect-title mb-2 text-center">
                Live <span className="accent">Detection</span>
              </h1>
              <p className="page-hero-sub mx-auto" data-reveal="true" data-reveal-delay="120">
                AI-powered YOLOv8 face detection on live streams. Choose single feed or monitor multiple streams simultaneously.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Detection Console ─────────────────────────────────── */}
      <div className="container pb-5">
        <div className="row justify-content-center">
          <div className="col-lg-10">
            <div className="video-panel">

              {/* Controls View Mode and Model selectors */}
              <div className="row mb-4 g-3 align-items-stretch">
                {/* Left: Camera View Card */}
                <div className="col-12 col-md-5 col-lg-4">
                  <div className="detection-control-card h-100 d-flex flex-column justify-content-center p-3">
                    <div className="d-flex align-items-center gap-2 mb-2">
                      <i className="bi bi-camera-video text-primary"></i>
                      <span className="fw-semibold text-heading" style={{ fontSize: '0.92rem' }}>Camera View</span>
                    </div>
                    <div className="d-flex gap-2 w-100">
                      <button onClick={() => setViewMode('single')} className={`btn view-toggle-card-btn w-50 ${viewMode === 'single' ? 'active' : ''}`}>
                        <i className="bi bi-camera-video"></i>
                        <span style={{ fontSize: '0.82rem' }}>Single Camera</span>
                      </button>
                      <button onClick={() => setViewMode('grid')} className={`btn view-toggle-card-btn w-50 ${viewMode === 'grid' ? 'active' : ''}`}>
                        <i className="bi bi-grid-3x3-gap"></i>
                        <span style={{ fontSize: '0.82rem' }}>Multi-Camera Grid</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right: Model Selection */}
                <div className="col-12 col-md-7 col-lg-8">
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

              {/* Single Video feed Panel */}
              {viewMode === 'single' && (
                <div id="video-feed-container" className={`mb-4 d-flex align-items-center justify-content-center ${isFeedRunning ? 'feed-active' : ''}`}>
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
                    style={{ objectFit: 'contain', display: isFeedRunning && !feedError ? 'block' : 'none' }}
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
                  <div className="row row-cols-1 row-cols-md-2 g-4 mb-4">
                    {gridCameras.map(camera => (
                      <div className="col" key={camera.id}>
                        <div className="p-3 rounded-4"
                          style={{ background: 'var(--bg-surface-solid)', border: `1px solid ${isFeedRunning ? 'rgba(34, 197, 94, 0.4)' : 'var(--border-subtle)'}`, position: 'relative', overflow: 'hidden', boxShadow: 'var(--shadow-sm)', transition: 'border-color 0.4s ease' }}>

                          {/* Card Header */}
                          <div className="d-flex justify-content-between align-items-center mb-3">
                            <span className="fw-bold small text-uppercase"
                              style={{ letterSpacing: '0.5px', fontSize: '0.825rem', color: 'var(--text-heading)' }}><i
                                className="bi bi-camera-video-fill text-primary me-2"></i>{camera.name}</span>
                            <span className={`badge rounded-pill px-2.5 py-1 status-badge-indicator ${isFeedRunning ? 'badge-active' : 'badge-inactive'}`}
                              style={{ fontSize: '0.65rem' }}>{isFeedRunning ? 'Online' : 'Offline'}</span>
                          </div>

                          {/* Video Frame */}
                          <div
                            className="position-relative overflow-hidden rounded-3 mb-3 bg-black d-flex align-items-center justify-content-center"
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
                              style={{ objectFit: 'contain', display: isFeedRunning ? 'block' : 'none' }}
                              decoding="async"
                            />
                          </div>

                          {/* Card Stats/Actions Footer */}
                          <div className="d-flex justify-content-between align-items-center">
                            <div className="d-flex gap-3 font-mono" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                              <div>
                                <span className="fw-bold" style={{ color: 'var(--text-heading)' }}>{isFeedRunning ? (stats.fps || '0.0') : '0.0'}</span> <span className="opacity-75"
                                  style={{ fontSize: '0.7rem' }}>FPS</span>
                              </div>
                              <div>
                                <span className="fw-bold" style={{ color: 'var(--text-heading)' }}>{isFeedRunning ? (stats.faces || 0) : 0}</span> <span className="opacity-75"
                                  style={{ fontSize: '0.7rem' }}>Faces</span>
                              </div>
                            </div>
                            <div className="d-flex gap-2">
                              <button className="btn btn-sm rounded-pill px-3 py-1 fw-bold grid-maximize-btn"
                                style={{ fontSize: '0.75rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-heading)' }} onClick={() => { setViewMode('single'); setCameraType(camera.id); }}>
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

              {/* Camera Source Dropdown Selector (Single View Only) */}
              {viewMode === 'single' && (
                <>
                  <div className="row mb-4 justify-content-center g-4">
                    <div className="col-12">
                      <div className="d-flex align-items-center gap-2 mb-3">
                        <span className="hud-label" style={{ margin: 0 }}>Active Camera Source</span>
                      </div>
                      <div className="d-flex gap-2">
                        <span className="control-pill-badge-rect d-none d-sm-inline-flex align-items-center px-3 fw-bold">
                          <span className="control-pill-icon d-inline-flex align-items-center justify-content-center me-2" style={{ width: '28px', height: '28px' }}>
                            <i className="bi bi-camera" style={{ fontSize: '0.85rem' }}></i>
                          </span>
                          SOURCE
                        </span>

                        <div className="custom-dropdown flex-grow-1" onClick={() => { setCameraDropdownOpen(!cameraDropdownOpen); setModelDropdownOpen(false); }}>
                          <div className="dropdown-selected-rect">
                            <span className="text-truncate me-2">
                              {cameraType === '0' && 'Default Webcam'}
                              {cameraType === 'url' && 'IP Camera (URL)'}
                              {cameras.find(c => c.id === cameraType)?.name}
                            </span>
                            <div className="d-flex align-items-center gap-2 ms-auto me-2">
                              {isFeedRunning && (stats.resolution || '640x480') && (
                                <span className="badge rounded-pill px-2.5 py-1 text-primary border border-primary border-opacity-25 font-mono fw-bold"
                                  style={{ background: 'rgba(13, 110, 253, 0.12)', fontSize: '0.75rem', letterSpacing: '0.5px' }}>
                                  <i className="bi bi-aspect-ratio me-1"></i>{stats.resolution || '640x480'}
                                </span>
                              )}
                            </div>
                            <i className="bi bi-chevron-down small opacity-50 flex-shrink-0"></i>

                          </div>
                          <div className={`dropdown-options ${cameraDropdownOpen ? 'open' : ''}`}>
                            {cameras.map((camera, i) => (
                              <div key={camera.id} className={`dropdown-option ${cameraType === camera.id ? 'active' : ''}`} onClick={() => setCameraType(camera.id)}>{camera.name}</div>
                            ))}
                            {cameras.length === 0 && <div className={`dropdown-option ${cameraType === '0' ? 'active' : ''}`} onClick={() => setCameraType('0')}>Default Webcam</div>}
                            <div className={`dropdown-option ${cameraType === 'url' ? 'active' : ''}`} onClick={() => setCameraType('url')}>IP Camera (URL)</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {cameraType === 'url' && (
                    <div className="row mb-4 justify-content-center">
                      <div className="col-12">
                        <div className="d-flex align-items-center gap-2 mb-3">
                          <span className="hud-label" style={{ margin: 0 }}>IP Camera URL</span>
                        </div>
                        <div className="d-flex gap-2">
                          <span className="d-none d-sm-flex align-items-center px-4 rounded-pill font-mono"
                            style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', whiteSpace: 'nowrap', fontSize: '.85rem', color: 'var(--text-secondary)' }}>
                            <i className="bi bi-link-45deg me-2 text-primary"></i> URL
                          </span>
                          <input type="text" className="form-control shadow-none rounded-3 flex-grow-1"
                            placeholder="Enter IP Camera URL (e.g. http://192.168.1.100:8080/video)"
                            value={cameraUrl}
                            onChange={(e) => setCameraUrl(e.target.value)}
                            style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', height: '48px', color: 'var(--text-heading)' }} />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Unified Telemetry HUD Bar (Matching user screenshot) */}
                  {/* Unified Telemetry HUD Bar */}
                  <div className="mb-4 py-3 px-2 rounded-4 shadow-sm"
                    style={{ background: 'var(--bg-surface-solid)', border: '1px solid var(--border-color)' }}>
                    <div className="row text-center align-items-center g-0">
                      {/* Status Column */}
                      <div className="col-4" style={{ borderRight: '1px solid var(--border-subtle)' }}>
                        <div className="d-flex align-items-center justify-content-center mb-1" style={{ gap: '8px' }}>
                          <div id="status-dot" className={`rounded-circle flex-shrink-0 ${isFeedRunning ? 'dot-active' : ''}`}
                            style={{ width: '8px', height: '8px', background: isFeedRunning ? '#22c55e' : '#ef4444', boxShadow: isFeedRunning ? '0 0 10px rgba(34,197,94,.8)' : '0 0 10px rgba(239,68,68,.7)' }}></div>
                          <span className="fw-bold" style={{ fontSize: 'clamp(0.95rem, 3.2vw, 1.2rem)', color: isFeedRunning ? '#22c55e' : '#ef4444' }}>
                            {isFeedRunning ? 'Online' : 'Offline'}
                          </span>
                        </div>
                        <div className="text-secondary text-uppercase fw-semibold" style={{ fontSize: '0.68rem', letterSpacing: '0.8px' }}>
                          STATUS
                        </div>
                      </div>

                      {/* Framerate Column */}
                      <div className="col-4" style={{ borderRight: '1px solid var(--border-subtle)' }}>
                        <div className="d-flex align-items-baseline justify-content-center gap-1 mb-1">
                          <span className="fw-bold font-mono" style={{ fontSize: 'clamp(1.05rem, 3.5vw, 1.3rem)', color: 'var(--text-heading)' }}>
                            {isFeedRunning ? (stats.fps || '0.0') : '0.0'}
                          </span>
                          <span className="text-secondary font-mono fw-bold" style={{ fontSize: '0.68rem' }}>FPS</span>
                        </div>
                        <div className="text-secondary text-uppercase fw-semibold" style={{ fontSize: '0.68rem', letterSpacing: '0.8px' }}>
                          FRAMERATE
                        </div>
                      </div>

                      {/* Detections Column */}
                      <div className="col-4">
                        <div className="d-flex align-items-baseline justify-content-center gap-1 mb-1">
                          <span className="fw-bold font-mono" style={{ fontSize: 'clamp(1.05rem, 3.5vw, 1.3rem)', color: 'var(--text-heading)' }}>
                            {isFeedRunning ? (stats.faces || 0) : 0}
                          </span>
                          <span className="text-secondary font-mono fw-semibold" style={{ fontSize: '0.68rem' }}>Active</span>
                        </div>
                        <div className="text-secondary text-uppercase fw-semibold" style={{ fontSize: '0.68rem', letterSpacing: '0.8px' }}>
                          DETECTIONS
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Controls */}
              <div className="d-flex justify-content-center align-items-center gap-3 mt-4 flex-wrap w-100">
                <button onClick={(e) => { e.currentTarget.blur(); handleStartFeed(); }} className="btn-detect-start">
                  <i className="bi bi-play-fill fs-5"></i> Start Feed
                </button>
                <button onClick={(e) => { e.currentTarget.blur(); handleStopFeed(); }} className="btn-detect-stop">
                  <i className="bi bi-stop-fill fs-5"></i> Stop Feed
                </button>
              </div>
            </div>

            {/* Redesigned Live Detections HUD Panel */}
            <div className="video-panel mt-3" style={{ display: isFeedRunning ? 'block' : 'none' }}>
              {/* Card Header */}
              <div className="d-flex justify-content-between align-items-center mb-2.5 pb-2" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <div className="d-flex align-items-center gap-2 min-w-0">
                  <i className="bi bi-radar text-primary fs-5 flex-shrink-0"></i>
                  <div className="min-w-0">
                    <h6 className="fw-bold text-dynamic mb-0 text-uppercase text-truncate" style={{ letterSpacing: '0.8px', fontSize: '0.85rem' }}>
                      Live Detections
                    </h6>
                    <span className="text-secondary font-mono d-block text-truncate" style={{ fontSize: '0.7rem' }}>Real-time face telemetry</span>
                  </div>
                </div>
                <div className="d-flex align-items-center gap-2 flex-shrink-0 ms-2">
                  <span className="badge rounded-pill px-3 py-1.5 fw-bold d-inline-flex align-items-center" style={{ fontSize: '0.72rem', background: stats.names.length > 0 ? 'rgba(34, 197, 94, 0.12)' : 'rgba(13, 110, 253, 0.08)', color: stats.names.length > 0 ? '#22c55e' : '#2563eb', border: `1px solid ${stats.names.length > 0 ? 'rgba(34, 197, 94, 0.25)' : 'rgba(13, 110, 253, 0.2)'}` }}>
                    <span className="rounded-circle flex-shrink-0" style={{ width: '6px', height: '6px', marginRight: '7px', background: stats.names.length > 0 ? '#22c55e' : '#2563eb', boxShadow: stats.names.length > 0 ? '0 0 6px rgba(34, 197, 94, 0.8)' : '0 0 6px rgba(13, 110, 253, 0.8)' }}></span>
                    <span>{stats.names.length} Active</span>
                  </span>
                  <button type="button" className="btn btn-sm text-secondary p-1 border-0 rounded-circle flex-shrink-0" onClick={() => setIsDetectionsMinimized(!isDetectionsMinimized)} style={{ background: 'var(--bg-input)', lineHeight: 1 }}>
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
                    <div className="d-flex flex-column gap-2">
                      {stats.names.map((name, i) => {
                        const isUnknown = name.toLowerCase() === 'unknown';
                        return (
                          <div key={i} className="d-flex align-items-center justify-content-between p-2.5 rounded-3" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-subtle)' }}>
                            <div className="d-flex align-items-center gap-2.5">
                              <div className="rounded-circle d-flex align-items-center justify-content-center" style={{ width: '32px', height: '32px', background: isUnknown ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)', color: isUnknown ? '#ef4444' : '#10b981' }}>
                                <i className={`bi ${isUnknown ? 'bi-person-x-fill' : 'bi-person-check-fill'}`}></i>
                              </div>
                              <span className="fw-bold" style={{ color: isUnknown ? '#ef4444' : 'var(--text-heading)', fontSize: '0.88rem' }}>
                                {name}
                              </span>
                            </div>
                            <span className="badge rounded-pill px-2.5 py-1 fw-bold" style={{ fontSize: '0.7rem', background: isUnknown ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)', color: isUnknown ? '#ef4444' : '#10b981', border: `1px solid ${isUnknown ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}` }}>
                              {isUnknown ? 'UNKNOWN INTRUDER' : 'VERIFIED PERSON'}
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
    </>
  );
}
