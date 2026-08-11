import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import API from '../api/axios';

export default function CamerasPage() {
  const [cameras, setCameras] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [editCamera, setEditCamera] = useState(null);
  const [deleteCamera, setDeleteCamera] = useState(null);

  const fetchCameras = async () => {
    try {
      const response = await API.get('/cameras/');
      setCameras(response.data);
    } catch (error) {
      console.error("Failed to fetch cameras", error);
    }
  };

  useEffect(() => {
    fetchCameras();

    const revealElements = document.querySelectorAll("[data-reveal]");
    const revealOnScroll = function () {
      const windowHeight = window.innerHeight;
      revealElements.forEach(el => {
        const elementTop = el.getBoundingClientRect().top;
        const revealPoint = 150;
        if (elementTop < windowHeight - revealPoint) {
          el.classList.add("is-visible");
        }
      });
    };

    window.addEventListener("scroll", revealOnScroll);
    revealOnScroll();
    return () => window.removeEventListener("scroll", revealOnScroll);
  }, []);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return dateString;
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return dateString;
    }
  };

  const toggleStatus = async (id, currentStatus) => {
    try {
      await API.patch(`/cameras/${id}/`, { is_active: !currentStatus });
      fetchCameras();
    } catch (error) {
      console.error("Failed to toggle camera status:", error?.response?.data || error);
    }
  };

  const handleDeleteCamera = async (id) => {
    try {
      await API.delete(`/cameras/${id}/`);
      setShowDeleteModal(false);
      setDeleteCamera(null);
      fetchCameras();
    } catch (error) {
      console.error("Failed to delete camera:", error?.response?.data || error);
    }
  };

  const handleAddCamera = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
      name: formData.get('name'),
      source: formData.get('source'),
      orientation: formData.get('orientation') || 'normal',
      is_active: formData.get('is_active') === 'on' || formData.get('is_active') === 'true'
    };
    try {
      await API.post('/cameras/', data);
      setShowAddModal(false);
      fetchCameras();
    } catch (error) {
      console.error("Failed to add camera:", error?.response?.data || error);
    }
  };

  const handleEditCameraSubmit = async (e) => {
    e.preventDefault();
    if (!editCamera) return;
    const formData = new FormData(e.target);
    const data = {
      name: formData.get('name'),
      source: formData.get('source'),
      orientation: formData.get('orientation') || 'normal',
      is_active: formData.get('is_active') === 'on' || formData.get('is_active') === 'true'
    };
    try {
      await API.patch(`/cameras/${editCamera.id}/`, data);
      setShowEditModal(false);
      setEditCamera(null);
      fetchCameras();
    } catch (error) {
      console.error("Failed to update camera:", error?.response?.data || error);
    }
  };

  return (
    <>
      {/* Hero Section */}
      <section className="cameras-hero">
        <div className="cameras-hero-bg-wrapper">
          <div className="cameras-hero-bg"></div>
          <div className="cameras-orb"></div>
        </div>

        <div className="container position-relative" style={{ zIndex: 2 }}>
          <div className="row align-items-center text-center text-md-start">
            <div className="col-md-8 mb-3 mb-md-0">
              <h1 className="cameras-title mb-2">
                Camera <span className="accent">Management</span>
              </h1>
              <p className="page-hero-sub mx-auto ms-md-0">
                Configure, activate, and arrange surveillance video feeds for real-time YOLOv8 object detection.
              </p>
            </div>
            <div className="col-md-4 text-center text-md-end">
              <button className="btn btn-primary rounded-pill px-4 py-2.5 fw-bold shadow d-inline-flex align-items-center gap-2"
                onClick={() => setShowAddModal(true)}>
                <i className="bi bi-plus-circle-fill"></i> Add Camera
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Camera Grid Content */}
      <div className="container pb-5">
        <div className="row g-4">
          {cameras.length > 0 ? cameras.map((camera, index) => (
            <div className="col-lg-4 col-md-6" key={camera.id} data-reveal="true" data-reveal-delay={`${index * 100}`}>
              <div className={`camera-card ${camera.is_active ? 'camera-card-active' : 'camera-card-inactive'}`}>

                <div className="camera-card-header d-flex justify-content-between align-items-center">
                  <div className="d-flex align-items-center gap-3">
                    <div className="rounded-circle bg-primary bg-opacity-10 d-flex align-items-center justify-content-center flex-shrink-0"
                      style={{ width: '42px', height: '42px', border: '1px solid rgba(13, 110, 253, 0.2)' }}>
                      <i className="bi bi-camera-video-fill text-primary fs-6"></i>
                    </div>
                    <div className="d-flex flex-column justify-content-center">
                      <h5 className="fw-bold mb-0 lh-sm" style={{ fontSize: '1rem', color: 'var(--text-heading)' }}>{camera.name}</h5>
                      <span className="text-secondary small font-mono opacity-75" style={{ fontSize: '0.75rem', lineHeight: 1.3 }}>ID: {camera.id}</span>
                    </div>
                  </div>
                  <span className={`badge rounded-pill px-3 py-1.5 status-badge-indicator d-inline-flex align-items-center gap-2 ${camera.is_active ? 'badge-active' : 'badge-inactive'}`}>
                    <span className={`status-dot ${camera.is_active ? 'dot-active' : 'dot-inactive'}`}></span>
                    <span>{camera.is_active ? 'Active' : 'Inactive'}</span>
                  </span>
                </div>

                <div className="camera-card-body">
                  <div className="d-flex flex-column gap-3">
                    <div>
                      <span className="text-secondary small fw-bold text-uppercase d-block mb-1.5" style={{ fontSize: '0.7rem', letterSpacing: '0.5px' }}>Source Stream</span>
                      <div className="font-mono text-truncate rounded-pill d-flex align-items-center gap-2 px-3.5 py-2" style={{ background: 'rgba(13, 110, 253, 0.08)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(13, 110, 253, 0.25)', color: '#0d6efd', fontSize: '0.85rem', fontWeight: 600 }} title={camera.source}>
                        <i className="bi bi-link-45deg fs-6 text-primary opacity-75"></i>
                        <span className="text-truncate" style={{ letterSpacing: '0.01em' }}>{camera.source}</span>
                      </div>
                    </div>
                    <div className="row align-items-center pt-1">
                      <div className="col-6">
                        <span className="text-secondary small fw-bold text-uppercase d-block mb-1" style={{ fontSize: '0.7rem', letterSpacing: '0.5px' }}>Orientation</span>
                        <span className="small fw-semibold d-inline-block" style={{ color: 'var(--text-heading)' }}>
                          {camera.orientation === 'normal' && 'Normal'}
                          {camera.orientation === 'rot90_cw' && 'Rotate 90° CW'}
                          {camera.orientation === 'rot90_ccw' && 'Rotate 90° CCW'}
                          {camera.orientation === 'flip180' && 'Flip 180°'}
                          {camera.orientation === 'mirror_h' && 'Mirror Horizontally'}
                        </span>
                      </div>
                      <div className="col-6 text-end">
                        <span className="text-secondary small fw-bold text-uppercase d-block mb-1" style={{ fontSize: '0.7rem', letterSpacing: '0.5px' }}>Registered</span>
                        <span className="text-secondary small font-mono fw-medium">{formatDate(camera.created_at)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="camera-card-footer">
                  <div className="form-check form-switch m-0 d-flex align-items-center gap-2">
                    <input
                      className="form-check-input camera-toggle-switch"
                      type="checkbox"
                      role="switch"
                      id={`camera-switch-${camera.id}`}
                      checked={camera.is_active}
                      onChange={() => toggleStatus(camera.id, camera.is_active)}
                    />
                    <label
                      htmlFor={`camera-switch-${camera.id}`}
                      className="small fw-bold m-0 user-select-none"
                      style={{
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        letterSpacing: '0.06em',
                        color: camera.is_active ? '#22c55e' : 'var(--text-secondary, #94a3b8)'
                      }}
                    >
                      {camera.is_active ? 'ACTIVE' : 'INACTIVE'}
                    </label>
                  </div>

                  <div className="d-flex gap-2">
                    <button className="btn-action edit-camera-btn" title="Edit Camera" onClick={() => { setEditCamera(camera); setShowEditModal(true); }}>
                      <i className="bi bi-pencil-square"></i>
                    </button>
                    <button className="btn-action btn-action-delete delete-camera-btn" title="Delete Camera" onClick={() => { setDeleteCamera(camera); setShowDeleteModal(true); }}>
                      <i className="bi bi-trash-fill"></i>
                    </button>
                  </div>
                </div>

              </div>
            </div>
          )) : (
            <div className="col-12 text-center py-5">
              <div className="p-5 glass-card d-inline-block text-center" style={{ maxWidth: '480px' }}>
                <i className="bi bi-camera-video-off display-3 text-primary mb-3 d-block" style={{ opacity: 0.85 }}></i>
                <h4 className="text-dynamic fw-bold mb-2">No Cameras Configured</h4>
                <p className="text-secondary mb-4 small" style={{ color: 'var(--text-secondary)' }}>
                  Please add a camera configuration (webcam index or IP camera RTSP URL) to begin monitoring.
                </p>
                <button className="btn btn-primary rounded-pill px-4 shadow-sm" onClick={() => setShowAddModal(true)}>
                  Add Default Webcam
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Camera Modal */}
      {showAddModal && (
        <>
          <div className="modal-backdrop fade show glass-backdrop" style={{ opacity: 0.7, backdropFilter: 'blur(8px)' }}></div>
          <div className="modal fade show d-block glass-modal" tabIndex="-1" aria-hidden="true">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header border-0 pb-0 pt-4 px-4">
                  <h5 className="modal-title text-dynamic fw-bold"><i className="bi bi-camera-video-fill text-primary me-2"></i>ADD NEW CAMERA</h5>
                  <button type="button" className="btn-close text-dynamic" onClick={() => setShowAddModal(false)} aria-label="Close"></button>
                </div>
                <form onSubmit={handleAddCamera}>
                  <div className="modal-body p-4">
                    <div className="mb-3">
                      <label className="form-label text-heading small fw-bold text-uppercase">Camera Name</label>
                      <input type="text" name="name" className="form-control rounded-pill px-3.5 py-2.5" placeholder="e.g. Front Gate" required />
                    </div>
                    <div className="mb-3">
                      <label className="form-label text-heading small fw-bold text-uppercase">Stream Source</label>
                      <input type="text" name="source" className="form-control font-mono rounded-pill px-3.5 py-2.5" placeholder="e.g. 0 (webcam) or rtsp://192.168.1.50/live" required />
                    </div>
                    <div className="row g-3 mb-3">
                      <div className="col-md-6">
                        <label className="form-label text-heading small fw-bold text-uppercase">Orientation</label>
                        <select name="orientation" className="form-select rounded-pill px-3.5 py-2.5">
                          <option value="normal">Normal</option>
                          <option value="rot90_cw">Rotate 90° CW</option>
                          <option value="rot90_ccw">Rotate 90° CCW</option>
                          <option value="flip180">Flip 180°</option>
                          <option value="mirror_h">Mirror Horizontally</option>
                        </select>
                      </div>
                      <div className="col-md-6">
                        <label className="form-label text-heading small fw-bold text-uppercase">Camera Status</label>
                        <div className="form-control rounded-pill px-3.5 d-flex align-items-center justify-content-between" style={{ minHeight: '42px', paddingRight: '14px' }}>
                          <span className="small fw-bold text-heading me-2">IS ACTIVE</span>
                          <div className="form-check form-switch m-0 p-0 d-flex align-items-center">
                            <input name="is_active" className="form-check-input m-0" type="checkbox" defaultChecked style={{ width: '2.3em', height: '1.15em', cursor: 'pointer' }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="modal-footer border-0 pt-0 pb-4 px-4 d-flex gap-2">
                    <button type="button" className="btn btn-cancel-red rounded-pill px-4 flex-grow-1" onClick={() => setShowAddModal(false)}>Cancel</button>
                    <button type="submit" className="btn btn-primary rounded-pill px-4 flex-grow-1">Save Camera</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Edit Camera Modal */}
      {showEditModal && editCamera && (
        <>
          <div className="modal-backdrop fade show glass-backdrop" style={{ opacity: 0.7, backdropFilter: 'blur(8px)' }}></div>
          <div className="modal fade show d-block glass-modal" tabIndex="-1" aria-hidden="true">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header border-0 pb-0 pt-4 px-4">
                  <h5 className="modal-title text-dynamic fw-bold"><i className="bi bi-pencil-square text-primary me-2"></i>EDIT CAMERA</h5>
                  <button type="button" className="btn-close text-dynamic" onClick={() => setShowEditModal(false)} aria-label="Close"></button>
                </div>
                <form onSubmit={handleEditCameraSubmit}>
                  <div className="modal-body p-4">
                    <div className="mb-3">
                      <label className="form-label text-heading small fw-bold text-uppercase">Camera Name</label>
                      <input type="text" name="name" className="form-control rounded-pill px-3.5 py-2.5" defaultValue={editCamera.name} required />
                    </div>
                    <div className="mb-3">
                      <label className="form-label text-heading small fw-bold text-uppercase">Stream Source</label>
                      <input type="text" name="source" className="form-control font-mono rounded-pill px-3.5 py-2.5" defaultValue={editCamera.source} required />
                    </div>
                    <div className="row g-3 mb-3">
                      <div className="col-md-6">
                        <label className="form-label text-heading small fw-bold text-uppercase">Orientation</label>
                        <select name="orientation" className="form-select rounded-pill px-3.5 py-2.5" defaultValue={editCamera.orientation}>
                          <option value="normal">Normal</option>
                          <option value="rot90_cw">Rotate 90° CW</option>
                          <option value="rot90_ccw">Rotate 90° CCW</option>
                          <option value="flip180">Flip 180°</option>
                          <option value="mirror_h">Mirror Horizontally</option>
                        </select>
                      </div>
                      <div className="col-md-6">
                        <label className="form-label text-heading small fw-bold text-uppercase">Camera Status</label>
                        <div className="form-control rounded-pill px-3.5 d-flex align-items-center justify-content-between" style={{ minHeight: '42px', paddingRight: '14px' }}>
                          <span className="small fw-bold text-heading me-2">IS ACTIVE</span>
                          <div className="form-check form-switch m-0 p-0 d-flex align-items-center">
                            <input name="is_active" className="form-check-input m-0" type="checkbox" defaultChecked={editCamera.is_active} style={{ width: '2.3em', height: '1.15em', cursor: 'pointer' }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="modal-footer border-0 pt-0 pb-4 px-4 d-flex gap-2">
                    <button type="button" className="btn btn-cancel-red rounded-pill px-4 flex-grow-1" onClick={() => setShowEditModal(false)}>Cancel</button>
                    <button type="submit" className="btn btn-primary rounded-pill px-4 flex-grow-1">Update Camera</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Delete Confirmation Modal - Mounted directly on document.body via React Portal */}
      {showDeleteModal && deleteCamera && createPortal(
        <>
          <div className="modal-backdrop fade show glass-backdrop" style={{ opacity: 0.7, backdropFilter: 'blur(8px)', zIndex: 10540 }} onClick={() => setShowDeleteModal(false)}></div>
          <div
            className="modal fade show"
            tabIndex="-1"
            aria-hidden="true"
            onClick={() => setShowDeleteModal(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: '100vw',
              height: '100vh',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10550,
              padding: '1rem'
            }}
          >
            <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
              <div
                className="modal-content overflow-hidden"
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: '100%',
                  maxWidth: '340px',
                  background: 'rgba(255, 255, 255, 0.45)',
                  border: '1px solid rgba(255, 255, 255, 0.8)',
                  borderRadius: '28px',
                  backdropFilter: 'blur(30px) saturate(180%)',
                  WebkitBackdropFilter: 'blur(30px) saturate(180%)',
                  boxShadow: '0 20px 45px rgba(31, 38, 135, 0.08), inset 0 1px 1px rgba(255, 255, 255, 0.9)'
                }}
              >
                <div className="modal-body p-4 text-center d-flex flex-column align-items-center justify-content-center">
                  <div className="bg-danger bg-opacity-10 rounded-circle d-inline-flex align-items-center justify-content-center mb-3"
                    style={{ width: '64px', height: '64px', border: '1px solid rgba(220, 53, 69, 0.2)' }}>
                    <i className="bi bi-exclamation-triangle-fill text-danger fs-2"></i>
                  </div>
                  <h5 className="fw-bold mb-2 text-center" style={{ color: 'var(--text-heading)' }}>Delete Camera?</h5>
                  <p className="small mb-4 lh-base text-center" style={{ color: 'var(--text-secondary)' }}>
                    Are you sure you want to remove <strong style={{ color: 'var(--text-heading)' }}>{deleteCamera.name}</strong> from configuration? This will terminate all active feeds for this camera.
                  </p>
                  <form className="w-100" onSubmit={(e) => { e.preventDefault(); if (deleteCamera) handleDeleteCamera(deleteCamera.id); }}>
                    <div className="d-flex gap-2 w-100">
                      <button type="button" className="view-toggle-btn w-100 py-2 small fw-bold" onClick={() => setShowDeleteModal(false)}>Decline</button>
                      <button type="submit" className="btn-detect-stop w-100 py-2 small fw-bold">Confirm</button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
}
