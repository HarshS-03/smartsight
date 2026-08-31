import React, { useState } from 'react';
import { X, AlertTriangle, CheckCircle, ShieldAlert, UserPlus, Eye, Clock, MapPin } from 'lucide-react';

export default function UnknownCapturesModal({ show, onClose }) {
  const [captures, setCaptures] = useState([
    { id: 101, timestamp: '14:22:05', zone: 'Corridor 2', confidence: '78%', status: 'Unrecognized' },
    { id: 102, timestamp: '14:28:19', zone: 'Stairs A', confidence: '84%', status: 'Unknown Face' },
    { id: 103, timestamp: '14:35:40', zone: 'Gate 1', confidence: '91%', status: 'Tailgating Risk' },
  ]);

  if (!show) return null;

  const handleDismiss = (id) => {
    setCaptures(captures.filter(c => c.id !== id));
  };

  return (
    <div className="modal d-block" style={{ backgroundColor: 'rgba(0, 0, 0, 0.75)', }} tabIndex="-1">
      <div className="modal-dialog modal-lg modal-dialog-centered">
        <div className="modal-content border-warning border-opacity-25 text-body" style={{ background: 'var(--modal-bg)', border: '1px solid var(--modal-border)' }}>
          <div className="modal-header border-secondary border-opacity-10 py-3">
            <div className="d-flex align-items-center gap-2">
              <div className="p-2 rounded-2 bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25">
                <AlertTriangle size={18} />
              </div>
              <div>
                <h5 className="modal-title fw-bold m-0 text-heading">Pending Unknown Captures</h5>
                <span className="font-telemetry text-muted small">Action Required: {captures.length} reviewable items</span>
              </div>
            </div>
            <button type="button" className="btn-close" style={{ filter: 'var(--btn-close-filter, none)' }} onClick={onClose}></button>
          </div>

          <div className="modal-body p-4">
            {captures.length === 0 ? (
              <div className="text-center py-5">
                <CheckCircle size={48} className="text-success mb-3 opacity-75" />
                <h6 className="fw-semibold text-heading">All Unknown Captures Cleared</h6>
                <p className="text-secondary small m-0">No pending alerts requiring manual verification.</p>
              </div>
            ) : (
              <div className="d-flex flex-column gap-3">
                {captures.map((cap) => (
                  <div key={cap.id} className="p-3 rounded-3 border border-secondary border-opacity-25 d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-3" style={{ background: 'var(--bg-input)' }}>
                    <div className="d-flex align-items-center gap-3">
                      {/* Placeholder Snapshot thumbnail */}
                      <div className="rounded-2 bg-secondary bg-opacity-25 border border-secondary border-opacity-25 d-flex align-items-center justify-content-center" style={{ width: '64px', height: '64px' }}>
                        <Eye size={24} className="text-secondary opacity-75" />
                      </div>
                      <div>
                        <div className="d-flex align-items-center gap-2 mb-1">
                          <span className="badge bg-warning bg-opacity-25 text-warning border border-warning border-opacity-25 font-telemetry">{cap.status}</span>
                          <span className="font-telemetry text-secondary small">ID #{cap.id}</span>
                        </div>
                        <div className="d-flex align-items-center gap-3 text-secondary font-telemetry" style={{ fontSize: '0.8rem' }}>
                          <span><Clock size={12} className="me-1" />{cap.timestamp}</span>
                          <span><MapPin size={12} className="me-1" />{cap.zone}</span>
                          <span className="text-info">Score: {cap.confidence}</span>
                        </div>
                      </div>
                    </div>

                    <div className="d-flex align-items-center gap-2">
                      <button className="btn btn-outline-info btn-sm font-telemetry d-flex align-items-center gap-1">
                        <UserPlus size={14} /> Add Person
                      </button>
                      <button onClick={() => handleDismiss(cap.id)} className="btn btn-outline-secondary btn-sm font-telemetry">
                        Dismiss
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="modal-footer border-secondary border-opacity-10 py-2">
            <button type="button" className="btn btn-secondary btn-sm font-telemetry" onClick={onClose}>
              Close Window
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
