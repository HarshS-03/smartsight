import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[Global ErrorBoundary caught error]:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-100 flex-grow-1 min-vh-100 d-flex flex-column justify-content-center align-items-center position-relative overflow-hidden p-3 p-md-5">
          <div className="page-hero-bg-wrapper full-page">
            <div className="page-hero-bg"></div>
            <div className="page-hero-orb"></div>
          </div>
          <div className="container position-relative d-flex justify-content-center" style={{ zIndex: 1 }}>
            <div className="p-4 p-md-5 rounded-5 error-card text-center" style={{
              maxWidth: '540px',
              width: '100%',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-color)',
              boxShadow: 'var(--shadow-lg)'
            }}>
              <div className="rounded-circle bg-danger bg-opacity-10 text-danger p-3 d-inline-flex mb-4" style={{ width: '76px', height: '76px', alignItems: 'center', justifyContent: 'center', fontSize: '2.2rem' }}>
                <i className="bi bi-exclamation-triangle-fill"></i>
              </div>
              
              <h2 className="fw-bold text-dynamic mb-2" style={{ fontSize: '1.6rem', color: 'var(--text-heading)' }}>Something Went Wrong</h2>
              <p className="small mb-4" style={{ color: 'var(--text-secondary)', lineHeight: '1.5' }}>An unexpected application error occurred while rendering this page. You can try refreshing the page or navigating back to safety.</p>

              {this.state.error && (
                <div className="p-3 rounded-3 text-start mb-4 overflow-auto font-mono text-danger small" style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', maxHeight: '120px', fontSize: '0.78rem' }}>
                  <strong>Error:</strong> {this.state.error.toString()}
                </div>
              )}

              <style>{`
                .error-card {
                  transition: all 0.3s ease !important;
                }
                .error-card:hover {
                  border-color: #ef4444 !important;
                  box-shadow: inset 0 0 0 1px #ef4444, 0 16px 36px rgba(0, 0, 0, 0.08), 0 0 20px rgba(239, 68, 68, 0.35) !important;
                  transform: translateY(-2px) !important;
                }
              `}</style>

              <div className="d-flex flex-column align-items-center gap-3 w-100">
                <button
                  type="button"
                  onClick={this.handleReload}
                  className="btn-auth-primary"
                  style={{
                    height: '46px',
                    minHeight: '46px',
                    width: '100%',
                    maxWidth: '220px',
                    margin: '0 auto',
                    borderRadius: '999px',
                    fontWeight: 600,
                    fontSize: '0.92rem'
                  }}
                >
                  <i className="bi bi-arrow-clockwise fs-5"></i>
                  <span>Refresh Page</span>
                </button>
                <button
                  type="button"
                  onClick={this.handleGoHome}
                  className="btn d-flex align-items-center justify-content-center gap-2 hover-glow"
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
                    boxShadow: 'var(--shadow-xs)',
                    cursor: 'pointer'
                  }}
                >
                  <i className="bi bi-house-door text-primary" style={{ fontSize: '1.05rem' }}></i>
                  <span>Back to Home</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
