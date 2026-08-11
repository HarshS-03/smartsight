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
        <div className="min-vh-100 d-flex align-items-center justify-content-center p-3 p-md-5" style={{ background: 'var(--bg-surface-solid, #0b0f19)' }}>
          <div className="p-4 p-md-5 rounded-4 glass-card text-center" style={{ maxWidth: '600px', width: '100%', border: '1px solid rgba(239, 68, 68, 0.3)', boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)' }}>
            <div className="rounded-circle bg-danger bg-opacity-10 text-danger p-3 d-inline-flex mb-4" style={{ width: '80px', height: '80px', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem' }}>
              <i className="bi bi-exclamation-triangle-fill"></i>
            </div>
            
            <h2 className="fw-bold text-dynamic mb-2">Something Went Wrong</h2>
            <p className="text-secondary small mb-4">An unexpected application error occurred while rendering this page. You can try refreshing the page or navigating back to safety.</p>

            {this.state.error && (
              <div className="p-3 rounded-3 text-start mb-4 overflow-auto font-mono text-danger small" style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', maxHeight: '140px', fontSize: '0.8rem' }}>
                <strong>Error:</strong> {this.state.error.toString()}
              </div>
            )}

            <div className="d-flex flex-column flex-sm-row justify-content-center gap-3">
              <button onClick={this.handleReload} className="btn btn-primary rounded-pill px-4 py-2.5 fw-bold d-flex align-items-center justify-content-center gap-2">
                <i className="bi bi-arrow-clockwise"></i> Refresh Page
              </button>
              <button onClick={this.handleGoHome} className="btn btn-outline-secondary rounded-pill px-4 py-2.5 fw-bold d-flex align-items-center justify-content-center gap-2">
                <i className="bi bi-house-door"></i> Back to Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
