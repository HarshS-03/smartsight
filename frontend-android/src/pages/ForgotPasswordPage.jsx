import React, { useState } from 'react';
import API from '../api/axios';

export default function ForgotPasswordPage({ setActivePage }) {
  const [username, setUsername] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!verified) {
      if (!username.trim() || !code.trim()) {
        setError('Please enter both your username and recovery code.');
        return;
      }
      setVerified(true);
    } else {
      if (!newPassword || newPassword.length < 4) {
        setError('Password must be at least 4 characters long.');
        return;
      }
      setLoading(true);
      try {
        const response = await API.post('/auth/forgot_password/', {
          username: username.trim(),
          code: code.trim(),
          new_password: newPassword
        });
        setSuccess(response.data?.message || 'Password reset successfully!');
        setTimeout(() => setActivePage('login'), 2000);
      } catch (err) {
        setError(err.response?.data?.error || 'Password reset failed. Please check your credentials.');
        setVerified(false);
      } finally {
        setLoading(false);
      }
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

                {error && (
                  <div className="alert alert-danger border-0 small mb-4 rounded-3 d-flex align-items-center py-2" role="alert">
                    <i className="bi bi-exclamation-triangle-fill me-2"></i> {error}
                  </div>
                )}

                {success && (
                  <div className="alert border-0 glass-alert small mb-4 rounded-3 d-flex align-items-center" role="alert">
                    <i className="bi bi-check-circle-fill me-2"></i> {success}
                  </div>
                )}

                <div className="d-flex flex-column align-items-center mt-4" style={{ gap: '16px' }}>
                  <button type="submit"
                    className="btn-auth-primary m-0"
                    disabled={loading}
                  >
                    {loading ? (
                      <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                    ) : (
                      <i className={`bi ${verified ? 'bi-shield-check' : 'bi-shield-lock'}`} style={{ fontSize: '1.05rem' }}></i>
                    )}
                    <span>{loading ? 'Processing...' : (verified ? 'Complete Reset' : 'Verify Identity')}</span>
                  </button>

                  <a href="#"
                    onClick={(e) => { e.preventDefault(); setActivePage('login'); }}
                    className="text-decoration-none small hover-white transition-all d-inline-flex align-items-center justify-content-center gap-2 py-2 px-3 rounded-pill"
                    style={{ color: 'var(--text-secondary)', background: 'var(--bg-surface-hover)', fontSize: '0.85rem' }}>
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
  </>
  );
}
