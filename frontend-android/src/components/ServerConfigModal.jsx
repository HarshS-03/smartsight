import React, { useState, useEffect } from 'react';
import API from '../api/axios';

export default function ServerConfigModal({ show, onClose }) {
  const [serverIp, setServerIp] = useState('');
  const [testStatus, setTestStatus] = useState(null); // { type: 'loading' | 'success' | 'error', message: '' }

  useEffect(() => {
    if (show) {
      const saved = localStorage.getItem('server_ip') || '';
      setServerIp(saved);
      setTestStatus(null);
    }
  }, [show]);

  if (!show) return null;

  const handleTestConnection = async () => {
    if (!serverIp.trim()) {
      setTestStatus({ type: 'error', message: 'Please enter a valid IP address or hostname.' });
      return;
    }

    let clean = serverIp.trim().replace(/\/+$/, '');
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = `http://${clean}`;
    }

    setTestStatus({ type: 'loading', message: 'Pinging backend server...' });
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const targetUrl = `${clean}/api/health/`;
      const fallbackUrl = `${clean}/api/auth/me/`;

      let response;
      try {
        response = await fetch(targetUrl, { signal: controller.signal });
      } catch {
        response = await fetch(fallbackUrl, { signal: controller.signal });
      }
      clearTimeout(timeoutId);

      const latency = Date.now() - startTime;
      if (response && (response.ok || response.status === 401 || response.status === 403 || response.status === 404)) {
        setTestStatus({
          type: 'success',
          message: `Connected successfully! (${latency}ms latency)`
        });
      } else {
        setTestStatus({
          type: 'error',
          message: `Server responded with status ${response ? response.status : 'Unknown'}.`
        });
      }
    } catch (err) {
      setTestStatus({
        type: 'error',
        message: err.name === 'AbortError'
          ? 'Connection timed out (4s). Ensure computer & mobile are on same Wi-Fi.'
          : 'Could not connect to server. Check IP & port 8000.'
      });
    }
  };

  const handleSave = () => {
    let clean = serverIp.trim().replace(/\/+$/, '');
    if (clean && !clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = `http://${clean}`;
    }

    if (clean) {
      localStorage.setItem('server_ip', clean);
    } else {
      localStorage.removeItem('server_ip');
    }

    if (API.updateBaseUrl) {
      API.updateBaseUrl();
    }

    if (window.showToast) {
      window.showToast(clean ? `Server IP set to ${clean}` : 'Reset to default localhost', 'success', 'SERVER CONFIG');
    }

    onClose();
  };

  return (
    <>
      <div 
        className="modal-backdrop fade show" 
        style={{ 
          backgroundColor: 'rgba(15, 23, 42, 0.75)', 
          zIndex: 10500 
        }} 
        onClick={onClose}
      />
      
      <div 
        className="modal fade show d-block" 
        tabIndex="-1" 
        role="dialog"
        aria-modal="true"
        style={{ 
          zIndex: 10550,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          padding: '12px 0'
        }} 
        onClick={onClose}
      >
        <div 
          className="modal-dialog modal-dialog-centered px-3 my-auto" 
          onClick={e => e.stopPropagation()} 
          style={{ maxWidth: '440px', width: '100%', margin: 'auto' }}
        >
          <div 
            className="modal-content overflow-auto" 
            style={{
              maxHeight: 'calc(100dvh - 32px)',
              borderRadius: '24px',
              border: '1px solid var(--border-color)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              background: 'var(--modal-bg, var(--bg-surface-solid, #ffffff))'
            }}
          >
            {/* Modal Header */}
            <div className="modal-header border-0 p-4 pb-2 d-flex justify-content-between align-items-center">
              <div className="d-flex align-items-center gap-3">
                <div 
                  className="d-flex align-items-center justify-content-center rounded-3" 
                  style={{ width: '42px', height: '42px', backgroundColor: 'rgba(37, 99, 235, 0.12)', color: '#2563eb' }}
                >
                  <i className="bi bi-hdd-network-fill fs-5"></i>
                </div>
                <div>
                  <h5 className="modal-title fw-bold mb-0" style={{ fontSize: '1.15rem', color: 'var(--text-heading)' }}>
                    Server IP Config
                  </h5>
                  <span className="small" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Backend Connection Settings
                  </span>
                </div>
              </div>
              <button 
                type="button" 
                className="btn-close hover-glow" 
                onClick={onClose} 
                aria-label="Close"
                style={{ filter: 'var(--btn-close-filter, none)' }}
              />
            </div>

            {/* Modal Body */}
            <div className="modal-body p-4 pt-3">
              <p className="small mb-3" style={{ lineHeight: '1.45', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Enter your computer's local Wi-Fi IP (e.g. running Django on port 8000) so this mobile app can communicate with the backend.
              </p>

              <div className="mb-3">
                <label className="form-label small fw-semibold mb-1" style={{ color: 'var(--text-heading)' }}>
                  Server Host / IP Address
                </label>
                <div className="input-group">
                  <span 
                    className="input-group-text border-end-0" 
                    style={{ 
                      backgroundColor: 'var(--bg-input, #f8fafc)', 
                      borderColor: 'var(--border-color, #cbd5e1)', 
                      color: 'var(--text-secondary)' 
                    }}
                  >
                    <i className="bi bi-globe2"></i>
                  </span>
                  <input
                    type="url"
                    inputMode="url"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck="false"
                    className="form-control font-monospace border-start-0"
                    placeholder="http://192.168.1.10:8000"
                    value={serverIp}
                    onChange={e => setServerIp(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
                    style={{ 
                      fontSize: '0.92rem', 
                      padding: '12px',
                      backgroundColor: 'var(--bg-input, #f8fafc)',
                      borderColor: 'var(--border-color, #cbd5e1)',
                      color: 'var(--text-heading)'
                    }}
                  />
                </div>
              </div>

              {/* Connection Test Banner */}
              {testStatus && (
                <div 
                  className={`alert ${
                    testStatus.type === 'success' 
                      ? 'alert-success bg-success bg-opacity-10 text-success border-success border-opacity-25' 
                      : testStatus.type === 'error' 
                      ? 'alert-danger bg-danger bg-opacity-10 text-danger border-danger border-opacity-25' 
                      : 'alert-info bg-primary bg-opacity-10 text-primary border-primary border-opacity-25'
                  } small py-2 px-3 mb-3 rounded-3 d-flex align-items-center gap-2`} 
                  style={{ fontSize: '0.8rem', border: '1px solid' }}
                >
                  {testStatus.type === 'loading' && <span className="spinner-border spinner-border-sm" role="status"></span>}
                  {testStatus.type === 'success' && <i className="bi bi-check-circle-fill fs-6"></i>}
                  {testStatus.type === 'error' && <i className="bi bi-exclamation-triangle-fill fs-6"></i>}
                  <span>{testStatus.message}</span>
                </div>
              )}

              {/* Actions */}
              <div className="d-flex gap-2 mt-4">
                <button
                  type="button"
                  className="btn flex-grow-1 d-flex align-items-center justify-content-center gap-2"
                  style={{ 
                    height: '48px', 
                    borderRadius: '14px', 
                    fontWeight: '600', 
                    fontSize: '0.88rem',
                    backgroundColor: 'var(--bg-input, #f1f5f9)',
                    border: '1px solid var(--border-color, #cbd5e1)',
                    color: 'var(--text-heading)'
                  }}
                  onClick={handleTestConnection}
                  disabled={testStatus?.type === 'loading'}
                >
                  <i className="bi bi-broadcast text-primary"></i>
                  <span>Test Ping</span>
                </button>

                <button
                  type="button"
                  className="btn btn-primary flex-grow-1 d-flex align-items-center justify-content-center gap-2 shadow-sm"
                  style={{ 
                    height: '48px', 
                    borderRadius: '14px', 
                    fontWeight: '600', 
                    fontSize: '0.88rem',
                    boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)'
                  }}
                  onClick={handleSave}
                >
                  <i className="bi bi-check2"></i>
                  <span>Save & Apply</span>
                </button>
              </div>

            </div>
          </div>
        </div>
      </div>
    </>
  );
}
