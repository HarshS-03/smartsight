import React, { useState } from 'react';
import ServerConfigModal from '../components/ServerConfigModal';

export default function ForgotPasswordPage({ setActivePage }) {
  const [username, setUsername] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [verified, setVerified] = useState(false);
  const [success, setSuccess] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!verified) {
      // Mock verification
      setVerified(true);
    } else {
      // Mock completion
      setSuccess("Password reset successfully!");
      setTimeout(() => setActivePage('login'), 2000);
    }
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
            <div className="login-card p-4 p-md-5 rounded-5 position-relative overflow-hidden" style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-color)',
              boxShadow: 'var(--shadow-lg)',
            }}>

              {/* Server IP Config Gear Button */}
              <button 
                type="button" 
                className="btn position-absolute top-0 end-0 m-3 d-flex align-items-center justify-content-center hover-glow" 
                onClick={() => setShowConfigModal(true)}
                style={{ 
                  zIndex: 5, 
                  background: 'var(--bg-input, rgba(128,128,128,0.1))', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: '50%', 
                  width: '40px', 
                  height: '40px',
                  padding: 0
                }}
                title="Server IP Configuration"
              >
                <i className="bi bi-gear-fill" style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}></i>
              </button>

              <div className="position-absolute top-0 start-50 translate-middle"
                style={{ width: '200px', height: '200px', background: 'radial-gradient(circle, rgba(13, 110, 253, 0.15) 0%, transparent 70%)', zIndex: -1 }}>
              </div>

              <div className="text-center mb-5">
                <div className="d-inline-flex align-items-center justify-content-center bg-primary bg-opacity-10 rounded-circle mb-4 shadow-sm"
                  style={{ width: '80px', height: '80px', border: '1px solid rgba(13, 110, 253, 0.2)' }}>
                  {verified ? (
                    <i className="bi bi-key-fill text-primary" style={{ fontSize: '2.5rem' }}></i>
                  ) : (
                    <i className="bi bi-shield-lock-fill text-primary" style={{ fontSize: '2.5rem' }}></i>
                  )}
                </div>
                <h2 className="fw-bold mb-2" style={{ color: 'var(--text-heading)' }}>
                  {verified ? 'Reset Password' : '2-Step Recovery'}
                </h2>
                <p className="small" style={{ color: 'var(--text-secondary)' }}>
                  {verified ? 'Set your new system credentials' : 'Verify your identity via Security Code'}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="needs-validation">
                {!verified ? (
                  <>
                    <div className="mb-3">
                      <div className="form-floating custom-form-floating">
                        <input type="text" className="form-control" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} required />
                        <label style={{ color: 'var(--form-label)' }}>Username</label>
                      </div>
                    </div>
                    <div className="mb-4">
                      <div className="form-floating custom-form-floating">
                        <input type="password" className="form-control" placeholder="Security Code" value={code} onChange={(e) => setCode(e.target.value)} required />
                        <label style={{ color: 'var(--form-label)' }}>Security Code</label>
                      </div>
                      <div className="form-text opacity-50 mt-2" style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                        <i className="bi bi-info-circle me-1"></i> Enter your unique 2-Step system code
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="mb-4">
                    <div className="form-floating custom-form-floating">
                      <input type="password" className="form-control" placeholder="New Password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required autoFocus />
                      <label style={{ color: 'var(--form-label)' }}>New System Password</label>
                    </div>
                  </div>
                )}

                {success && (
                  <div className="alert border-0 glass-alert small mb-4 rounded-3 d-flex align-items-center" role="alert">
                    <i className="bi bi-check-circle-fill me-2"></i> {success}
                  </div>
                )}

                <button type="submit"
                  className="btn-detect-start w-100 py-3 d-flex align-items-center justify-content-center gap-2 mb-4"
                  style={{ height: '58px', letterSpacing: '0.1em' }}>
                  {verified ? 'Complete Reset' : 'Verify Identity'}
                </button>

                <div className="text-center">
                  <a href="#"
                    onClick={(e) => { e.preventDefault(); setActivePage('login'); }}
                    className="text-decoration-none small hover-white transition-all d-flex align-items-center justify-content-center gap-2"
                    style={{ color: 'var(--text-secondary)' }}>
                    <i className="bi bi-arrow-left"></i>
                    <span>Return to Login</span>
                  </a>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* IP Config Modal */}
    <ServerConfigModal show={showConfigModal} onClose={() => setShowConfigModal(false)} />
  </>
  );
}
