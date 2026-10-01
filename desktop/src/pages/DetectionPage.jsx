import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import API from '../api/axios';
import getImageUrl from '../utils/imageUrl';

export default function DetectionPage() {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({ total: 0, known: 0, unknown: 0 });
  const [filter, setFilter] = useState('ALL'); // 'ALL', 'KNOWN', 'UNKNOWN'
  const [isLoading, setIsLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedScan, setSelectedScan] = useState(null);
  const [imgError, setImgError] = useState(false);
  const [deleteLog, setDeleteLog] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [selectedScan]);

  const fetchRecentScans = async () => {
    try {
      const [logsRes, statsRes] = await Promise.all([
        API.get('/logs/'),
        API.get('/reports/stats/')
      ]);

      let logData = Array.isArray(logsRes.data) ? logsRes.data : [];
      // Enforce LIFO structure (newest first)
      logData = logData.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setLogs(logData);

      if (statsRes.data) {
        setStats({
          total: statsRes.data.total_detections || logData.length,
          known: statsRes.data.known_detections || 0,
          unknown: statsRes.data.unknown_detections || 0,
        });
      }
    } catch (err) {
      console.error('Error fetching mobile biometric scan logs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteLog = async (id) => {
    try {
      setIsDeleting(true);
      await API.delete(`/logs/${id}/`);
      setLogs((prev) => prev.filter((l) => l.id !== id));
      setDeleteLog(null);
      if (window.showToast) {
        window.showToast('Scan log entry deleted successfully.', 'success', 'LOG DELETED');
      }
      fetchRecentScans();
    } catch (err) {
      console.error('Failed to delete log:', err);
      if (window.showToast) {
        window.showToast('Could not delete record. Please check server connection.', 'error', 'DELETE FAILED');
      }
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    fetchRecentScans();
    if (!autoRefresh) return;
    const interval = setInterval(fetchRecentScans, 3500); // Poll every 3.5s for real-time mobile sync
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const filteredLogs = logs.filter((l) => {
    if (filter === 'KNOWN') return l.status === 'KNOWN';
    if (filter === 'UNKNOWN') return l.status === 'UNKNOWN';
    return true;
  });

  return (
    <div className="container-fluid py-4 px-xl-5" style={{ minHeight: '88vh' }}>
      {/* Page Header */}
      <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-3">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <span className="badge rounded-pill bg-success bg-opacity-10 text-success fw-bold px-3 py-1.5" style={{ fontSize: '0.78rem' }}>
              <i className="bi bi-broadcast me-1"></i> LIVE MOBILE VERIFICATION STREAM
            </span>
            <span className="badge bg-secondary bg-opacity-10 text-secondary rounded-pill px-2.5 py-1">
              Desktop Monitor
            </span>
          </div>
          <h2 className="fw-bold text-dynamic mb-1" style={{ fontSize: '1.6rem' }}>
            Department Biometric Entry Console
          </h2>
          <p className="text-secondary small mb-0">
            Real-time feed of people verified by mobile terminals. Dataset management is exclusively handled in the Dataset tab.
          </p>
        </div>

        <div className="d-flex align-items-center gap-2">
          <button
            type="button"
            className={`btn btn-sm rounded-pill px-3 py-2 fw-semibold d-inline-flex align-items-center gap-2 ${
              autoRefresh ? 'btn-outline-success active' : 'btn-outline-secondary'
            }`}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <i className={`bi ${autoRefresh ? 'bi-arrow-repeat spin' : 'bi-pause-circle'}`}></i>
            <span>{autoRefresh ? 'Auto Syncing (3s)' : 'Sync Paused'}</span>
          </button>

          <button
            type="button"
            className="btn btn-sm btn-primary rounded-pill px-3 py-2 fw-semibold d-inline-flex align-items-center gap-2"
            onClick={fetchRecentScans}
          >
            <i className="bi bi-arrow-clockwise"></i>
            <span>Refresh Now</span>
          </button>
        </div>
      </div>

      {/* Analytics KPI Metric Cards */}
      <div className="row g-3 mb-4">
        <div className="col-md-4">
          <div className="card stat-card-blue border-0 p-4 rounded-4 shadow-sm h-100" style={{ background: 'var(--bg-surface-solid)' }}>
            <div className="d-flex align-items-center justify-content-between h-100 gap-3">
              <div style={{ minWidth: 0, flex: 1 }}>
                <span className="text-secondary small fw-semibold text-uppercase d-block text-truncate" style={{ fontSize: '0.72rem', letterSpacing: '0.5px' }} title="Total Scans Today">
                  Total Scans Today
                </span>
                <h3 className="fw-bold text-dynamic mt-1 mb-0 font-mono">{stats.total}</h3>
              </div>
              <div className="rounded-3 p-3 bg-primary bg-opacity-10 text-primary flex-shrink-0 d-flex align-items-center justify-content-center" style={{ width: '56px', height: '56px' }}>
                <i className="bi bi-people-fill fs-4"></i>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-4">
          <div className="card stat-card-green border-0 p-4 rounded-4 shadow-sm h-100" style={{ background: 'var(--bg-surface-solid)' }}>
            <div className="d-flex align-items-center justify-content-between h-100 gap-3">
              <div style={{ minWidth: 0, flex: 1 }}>
                <span className="text-success small fw-semibold text-uppercase d-block text-truncate" style={{ fontSize: '0.72rem', letterSpacing: '0.5px' }} title="Authorized Entries (Known)">
                  Authorized Entries (Known)
                </span>
                <h3 className="fw-bold text-success mt-1 mb-0 font-mono">{stats.known}</h3>
              </div>
              <div className="rounded-3 p-3 bg-success bg-opacity-10 text-success flex-shrink-0 d-flex align-items-center justify-content-center" style={{ width: '56px', height: '56px' }}>
                <i className="bi bi-patch-check-fill fs-4"></i>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-4">
          <div className="card stat-card-red border-0 p-4 rounded-4 shadow-sm h-100" style={{ background: 'var(--bg-surface-solid)' }}>
            <div className="d-flex align-items-center justify-content-between h-100 gap-3">
              <div style={{ minWidth: 0, flex: 1 }}>
                <span className="text-danger small fw-semibold text-uppercase d-block text-truncate" style={{ fontSize: '0.72rem', letterSpacing: '0.5px' }} title="Denied / Strangers">
                  Denied / Strangers
                </span>
                <h3 className="fw-bold text-danger mt-1 mb-0 font-mono">{stats.unknown}</h3>
              </div>
              <div className="rounded-3 p-3 bg-danger bg-opacity-10 text-danger flex-shrink-0 d-flex align-items-center justify-content-center" style={{ width: '56px', height: '56px' }}>
                <i className="bi bi-shield-x fs-4"></i>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="card glass-card border-0 rounded-4 shadow-sm overflow-hidden" style={{ background: 'var(--bg-surface-solid)' }}>
        <div className="p-3 border-bottom d-flex align-items-center justify-content-between flex-wrap gap-2">
          <div className="d-flex align-items-center gap-2 flex-wrap">
            {[
              { id: 'ALL', label: 'All Mobile Scans', count: logs.length, color: '#2563eb' },
              { id: 'KNOWN', label: 'Allowed Personnel', count: logs.filter((l) => l.status === 'KNOWN').length, color: '#198754' },
              { id: 'UNKNOWN', label: 'Denied / Strangers', count: logs.filter((l) => l.status === 'UNKNOWN').length, color: '#dc3545' },
            ].map((tab) => {
              const isActive = filter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  className="btn btn-sm rounded-pill px-3 py-1.5 fw-semibold d-inline-flex align-items-center gap-2 transition-all shadow-sm"
                  style={{
                    background: isActive ? tab.color : 'var(--bg-input, rgba(255,255,255,0.05))',
                    color: isActive ? '#ffffff' : 'var(--text-secondary, #94a3b8)',
                    border: `1px solid ${isActive ? tab.color : 'var(--border-color, rgba(255,255,255,0.1))'}`,
                    fontSize: '0.8rem',
                  }}
                  onClick={() => setFilter(tab.id)}
                >
                  <span>{tab.label}</span>
                  <span
                    className="badge rounded-pill"
                    style={{
                      background: isActive ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)',
                      color: isActive ? '#ffffff' : 'var(--text-secondary, #94a3b8)',
                      fontSize: '0.72rem',
                    }}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          <span className="text-secondary small font-mono">
            Displaying {filteredLogs.length} Records
          </span>
        </div>

        {/* Live Records Table */}
        <div className="table-responsive">
          <table className="table custom-table table-hover align-middle mb-0">
            <thead className="small text-uppercase text-secondary" style={{ fontSize: '0.72rem', letterSpacing: '0.5px', background: 'var(--bg-surface-hover, rgba(255,255,255,0.03))' }}>
              <tr>
                <th className="ps-4" style={{ width: '60px' }}>No.</th>
                <th style={{ width: '90px' }}>Captured Face</th>
                <th>Person Name</th>
                <th>Device / Camera Source</th>
                <th>Access Status</th>
                <th>Confidence</th>
                <th>Verification Time</th>
                <th className="text-end pe-4">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-5 text-secondary">
                    {isLoading ? (
                      <div className="spinner-border spinner-border-sm text-primary" role="status"></div>
                    ) : (
                      <div>
                        <i className="bi bi-inbox fs-2 text-muted mb-2 d-block"></i>
                        <span>No biometric scans recorded yet. Scan a person using the mobile app.</span>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log, index) => {
                  const isAllowed = log.status === 'KNOWN' || log.status === 'APPROVED';
                  const dateStr = log.timestamp ? new Date(log.timestamp).toLocaleString() : '—';
                  const conf = log.confidence ? `${(log.confidence * (log.confidence <= 1 ? 100 : 1)).toFixed(1)}%` : '—';

                  return (
                    <tr key={log.id || index}>
                      <td className="ps-4 fw-semibold text-secondary font-mono" style={{ fontSize: '0.8rem' }}>
                        {index + 1}
                      </td>
                      <td>
                        {log.image_path ? (
                          <img
                            src={getImageUrl(log.image_path)}
                            alt="Scan face"
                            className="rounded-3 shadow-sm border"
                            style={{ width: '48px', height: '48px', objectFit: 'cover' }}
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                        ) : (
                          <div
                            className="rounded-3 d-flex align-items-center justify-content-center text-secondary"
                            style={{ width: '48px', height: '48px', background: 'var(--bg-input, rgba(255,255,255,0.05))' }}
                          >
                            <i className="bi bi-person-bounding-box fs-5"></i>
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="fw-bold text-dynamic" style={{ fontSize: '0.92rem' }}>
                          {log.person_name || 'Unregistered Person'}
                        </div>
                        <div className="text-secondary small" style={{ fontSize: '0.72rem' }}>
                          {isAllowed ? 'Authorized Entry' : 'Intruder / Stranger Attempt'}
                        </div>
                      </td>
                      <td>
                        <span
                          className="badge rounded-pill fw-normal d-inline-flex align-items-center gap-1.5 px-2.5 py-1"
                          style={{
                            background: 'var(--bg-input, rgba(255,255,255,0.06))',
                            color: 'var(--text-body, #cbd5e1)',
                            border: '1px solid var(--border-color, rgba(255,255,255,0.12))',
                            fontSize: '0.75rem',
                          }}
                        >
                          <i className="bi bi-phone me-1 text-primary"></i> {log.camera_name || 'Mobile App Scanner'}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`badge rounded-pill fw-bold px-2.5 py-1 ${
                            isAllowed ? 'bg-success text-white' : 'bg-danger text-white'
                          }`}
                          style={{ fontSize: '0.72rem' }}
                        >
                          {isAllowed ? '✓ ALLOWED' : '✕ DENIED'}
                        </span>
                      </td>
                      <td className="font-mono fw-semibold small text-secondary">
                        {conf}
                      </td>
                      <td className="text-secondary small font-mono">
                        {dateStr}
                      </td>
                      <td className="text-end pe-4">
                        <div className="d-inline-flex align-items-center gap-2 justify-content-end">
                          {log.image_path && (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary rounded-pill px-2.5 py-1 d-inline-flex align-items-center gap-1 shadow-xs"
                              onClick={() => setSelectedScan(log)}
                              title="Inspect high-res photo"
                              style={{ fontSize: '0.76rem' }}
                            >
                              <i className="bi bi-eye"></i> <span>View</span>
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger rounded-pill px-2.5 py-1 d-inline-flex align-items-center gap-1 shadow-xs"
                            onClick={() => setDeleteLog(log)}
                            title="Delete scan entry"
                            style={{ fontSize: '0.76rem' }}
                          >
                            <i className="bi bi-trash"></i> <span>Delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Photo Preview Modal Portaled */}
      {selectedScan &&
        createPortal(
          <>
            <div
              className="modal-backdrop fade show"
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                zIndex: 10550,
                backgroundColor: 'rgba(11, 15, 25, 0.82)',
                backdropFilter: 'blur(8px)',
              }}
              onClick={() => setSelectedScan(null)}
            />
            <div
              className="modal fade show d-flex align-items-center justify-content-center"
              tabIndex="-1"
              role="dialog"
              aria-modal="true"
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                width: '100vw',
                height: '100vh',
                zIndex: 10560,
                overflowY: 'auto',
                padding: '20px',
              }}
              onClick={() => setSelectedScan(null)}
            >
              <div
                className="w-100 my-auto"
                style={{ maxWidth: '520px' }}
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  className="modal-content overflow-hidden"
                  style={{
                    borderRadius: '24px',
                    border: '1px solid var(--modal-border, var(--border-color))',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
                    background: 'var(--modal-bg, var(--bg-surface-solid, #0f172a))',
                    color: 'var(--text-heading, #ffffff)',
                  }}
                >
                  {/* Modal Header */}
                  <div className="modal-header border-0 p-4 pb-3 d-flex justify-content-between align-items-center">
                    <div className="d-flex align-items-center gap-3">
                      <div
                        className="d-flex align-items-center justify-content-center rounded-3"
                        style={{
                          width: '42px',
                          height: '42px',
                          backgroundColor:
                            selectedScan.status === 'KNOWN'
                              ? 'rgba(22, 163, 74, 0.15)'
                              : 'rgba(220, 53, 69, 0.15)',
                          color: selectedScan.status === 'KNOWN' ? '#16a34a' : '#ef4444',
                        }}
                      >
                        <i
                          className={`bi ${
                            selectedScan.status === 'KNOWN'
                              ? 'bi-shield-check'
                              : 'bi-shield-exclamation'
                          } fs-4`}
                        ></i>
                      </div>
                      <div>
                        <h5 className="modal-title fw-bold mb-0" style={{ fontSize: '1.15rem', color: 'var(--text-heading)' }}>
                          Biometric Snapshot
                        </h5>
                        <span className="small text-secondary" style={{ fontSize: '0.78rem' }}>
                          Log Record #{selectedScan.id} • Terminal Capture
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn-close hover-glow ms-auto"
                      style={{
                        filter: 'var(--btn-close-filter, none)',
                        opacity: 0.85,
                        padding: '8px',
                      }}
                      onClick={() => setSelectedScan(null)}
                      aria-label="Close"
                    />
                  </div>

                  {/* Modal Body */}
                  <div className="modal-body p-4 pt-1">
                    {/* Snapshot Frame */}
                    <div
                      className="d-flex align-items-center justify-content-center rounded-4 overflow-hidden mb-3.5 position-relative border"
                      style={{
                        minHeight: '260px',
                        maxHeight: '340px',
                        background: 'var(--bg-input, rgba(0, 0, 0, 0.25))',
                        borderColor: 'var(--border-color)',
                      }}
                    >
                      {selectedScan.image_path && !imgError ? (
                        <img
                          src={getImageUrl(selectedScan.image_path)}
                          alt="Biometric Snapshot"
                          className="w-100 h-100"
                          style={{
                            objectFit: 'contain',
                            maxHeight: '340px',
                            display: 'block',
                          }}
                          onError={() => setImgError(true)}
                        />
                      ) : (
                        <div className="text-center py-5 px-3">
                          <i className="bi bi-person-bounding-box fs-1 text-secondary opacity-50 mb-2 d-block"></i>
                          <span className="small text-secondary">
                            Snapshot image not available or file removed
                          </span>
                        </div>
                      )}

                      {/* Floating Status Pill over image */}
                      <div className="position-absolute top-0 start-0 m-3">
                        <span
                          className={`badge rounded-pill fw-bold px-3 py-1.5 shadow-sm ${
                            selectedScan.status === 'KNOWN'
                              ? 'bg-success text-white'
                              : 'bg-danger text-white'
                          }`}
                          style={{ fontSize: '0.75rem', letterSpacing: '0.5px' }}
                        >
                          <i
                            className={`bi ${
                              selectedScan.status === 'KNOWN' ? 'bi-check-circle-fill' : 'bi-x-circle-fill'
                            } me-1.5`}
                          ></i>
                          {selectedScan.status === 'KNOWN' ? 'MATCH VERIFIED' : 'UNREGISTERED STRANGER'}
                        </span>
                      </div>
                    </div>

                    {/* Person Details Card */}
                    <div
                      className="p-3 rounded-4 mb-3"
                      style={{
                        background: 'var(--bg-surface-hover, rgba(255, 255, 255, 0.03))',
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      <div className="d-flex align-items-center justify-content-between mb-2">
                        <div>
                          <div className="small text-secondary" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                            Identified Person
                          </div>
                          <h4 className="fw-bold mb-0 text-dynamic" style={{ fontSize: '1.25rem' }}>
                            {selectedScan.person_name || 'Unregistered Person / Stranger'}
                          </h4>
                        </div>
                        {selectedScan.confidence !== undefined && selectedScan.confidence !== null && (
                          <div className="text-end">
                            <div className="small text-secondary" style={{ fontSize: '0.72rem', textTransform: 'uppercase' }}>
                              Confidence
                            </div>
                            <span className="fw-bold font-mono text-primary" style={{ fontSize: '1.1rem' }}>
                              {(selectedScan.confidence <= 1
                                ? selectedScan.confidence * 100
                                : Number(selectedScan.confidence)
                              ).toFixed(1)}%
                            </span>
                          </div>
                        )}
                      </div>

                      <hr className="my-2.5 opacity-10" />

                      <div className="row g-2 text-start">
                        <div className="col-6">
                          <div className="small text-secondary" style={{ fontSize: '0.72rem' }}>
                            Capture Device
                          </div>
                          <div className="small fw-semibold text-dynamic text-truncate">
                            <i className="bi bi-phone me-1 text-primary"></i>
                            {selectedScan.camera_name || 'Mobile Biometric Scanner'}
                          </div>
                        </div>
                        <div className="col-6">
                          <div className="small text-secondary" style={{ fontSize: '0.72rem' }}>
                            Detection Time
                          </div>
                          <div className="small fw-semibold text-dynamic font-mono text-truncate">
                            <i className="bi bi-clock me-1 text-secondary"></i>
                            {new Date(selectedScan.timestamp).toLocaleString([], {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Modal Actions */}
                    <div className="d-flex align-items-center justify-content-between gap-2 pt-1">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger rounded-pill px-3 py-1.5 fw-semibold d-inline-flex align-items-center gap-1.5"
                        onClick={() => {
                          const scanToDelete = selectedScan;
                          setSelectedScan(null);
                          setDeleteLog(scanToDelete);
                        }}
                      >
                        <i className="bi bi-trash"></i>
                        <span>Delete Scan</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-primary rounded-pill px-4 py-1.5 fw-semibold"
                        onClick={() => setSelectedScan(null)}
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>,
          document.body
        )}

      {/* Delete Confirmation Modal Portaled */}
      {deleteLog &&
        createPortal(
          <>
            <div
              className="modal-backdrop fade show"
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                zIndex: 10600,
                backgroundColor: 'rgba(11, 15, 25, 0.82)',
                backdropFilter: 'blur(8px)',
              }}
              onClick={() => !isDeleting && setDeleteLog(null)}
            />
            <div
              className="modal fade show d-flex align-items-center justify-content-center"
              tabIndex="-1"
              role="dialog"
              aria-modal="true"
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                width: '100vw',
                height: '100vh',
                zIndex: 10610,
                overflowY: 'auto',
                padding: '20px',
              }}
              onClick={() => !isDeleting && setDeleteLog(null)}
            >
              <div
                className="w-100 my-auto"
                style={{ maxWidth: '420px' }}
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  className="modal-content overflow-hidden p-4"
                  style={{
                    borderRadius: '24px',
                    border: '1px solid var(--modal-border, var(--border-color))',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
                    background: 'var(--modal-bg, var(--bg-surface-solid, #0f172a))',
                    color: 'var(--text-heading, #ffffff)',
                  }}
                >
                  <div className="d-flex align-items-center gap-3 mb-3">
                    <div
                      className="rounded-3 d-flex align-items-center justify-content-center text-danger flex-shrink-0"
                      style={{ width: '44px', height: '44px', background: 'rgba(220, 53, 69, 0.12)' }}
                    >
                      <i className="bi bi-exclamation-triangle-fill fs-4"></i>
                    </div>
                    <div>
                      <h5 className="fw-bold mb-0" style={{ fontSize: '1.1rem' }}>Delete Scan Record?</h5>
                      <span className="small text-secondary" style={{ fontSize: '0.76rem' }}>This action cannot be undone</span>
                    </div>
                  </div>

                  <p className="small text-secondary mb-4" style={{ lineHeight: '1.45' }}>
                    Are you sure you want to delete this scan entry for{' '}
                    <strong className="text-dynamic">{deleteLog.person_name || 'Unregistered Person'}</strong> (
                    {deleteLog.status}) recorded at{' '}
                    <span className="font-mono text-dynamic">{new Date(deleteLog.timestamp).toLocaleString()}</span>?
                  </p>

                  <div className="d-flex align-items-center justify-content-end gap-2">
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary rounded-pill px-3.5 py-1.5"
                      onClick={() => setDeleteLog(null)}
                      disabled={isDeleting}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-danger rounded-pill px-3.5 py-1.5 fw-bold d-inline-flex align-items-center gap-1.5"
                      onClick={() => handleDeleteLog(deleteLog.id)}
                      disabled={isDeleting}
                    >
                      {isDeleting ? (
                        <>
                          <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                          <span>Deleting...</span>
                        </>
                      ) : (
                        <>
                          <i className="bi bi-trash-fill"></i>
                          <span>Delete Record</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>,
          document.body
        )}

      <style>{`
        .spin {
          animation: spin 1s infinite linear;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
