import React, { useState } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import API from './api/axios';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import UnknownCapturesModal from './components/UnknownCapturesModal';
import HomePage from './pages/HomePage';
import AboutPage from './pages/AboutPage';
import LoginPage from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import DetectionPage from './pages/DetectionPage';
import CamerasPage from './pages/CamerasPage';
import DatasetPage from './pages/DatasetPage';
import ReportsPage from './pages/ReportsPage';
import NotificationsPage from './pages/NotificationsPage';
import AdminPanelPage from './pages/AdminPanelPage';

const VALID_PAGES = ['home', 'about', 'login', 'forgot_password', 'detection', 'cameras', 'dataset', 'reports', 'notifications', 'admin'];

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showCapturesModal, setShowCapturesModal] = useState(false);

  // Derive active page from react-router location
  const currentPath = location.pathname.replace(/^\/+|\/+$/g, '');
  const activePage = currentPath ? (VALID_PAGES.includes(currentPath) ? currentPath : 'home') : 'home';

  const setActivePage = (newPage) => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    const targetPath = newPage === 'home' ? '/' : `/${newPage}`;
    navigate(targetPath);
  };
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('user');
      if (saved) return JSON.parse(saved);
      const token = localStorage.getItem('access_token');
      if (token) return { username: 'USER' };
      return null;
    } catch {
      return null;
    }
  });

  // Automatically redirect away from login page if user is already logged in
  React.useEffect(() => {
    if (user && (activePage === 'login' || activePage === 'forgot_password')) {
      setActivePage('home');
    }
  }, [user, activePage]);

  React.useEffect(() => {
    const fetchCurrentUser = async () => {
      const token = localStorage.getItem('access_token');
      if (token) {
        try {
          const res = await API.get('/auth/me/');
          setUser(res.data);
          localStorage.setItem('user', JSON.stringify(res.data));
        } catch (err) {
          console.warn('[Auth Check] Could not verify session with server:', err);
          // Only clear tokens if explicit 401 Unauthorized returned by server
          if (err.response && err.response.status === 401) {
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            localStorage.removeItem('user');
            setUser(null);
          } else {
            // Keep existing cached user session for offline / temporary network delays
            const saved = localStorage.getItem('user');
            if (saved) {
              try { setUser(JSON.parse(saved)); } catch (e) {}
            }
          }
        }
      }
    };
    fetchCurrentUser();
  }, []);

  const [toast, setToast] = useState(null);

  React.useEffect(() => {
    let timer;
    window.showToast = (message, type = 'success', title = null) => {
      const autoTitle = title || (type === 'success' ? 'SUCCESS' : type === 'error' || type === 'danger' ? 'SYSTEM ALERT' : 'INFORMATION');
      setToast({ title: autoTitle, message, type });
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setToast(null), 4500);
    };

    const handleToastEvent = (e) => {
      if (e.detail) {
        const { title, message, type } = e.detail;
        window.showToast(message, type, title);
      }
    };
    window.addEventListener('show-toast', handleToastEvent);
    return () => {
      window.removeEventListener('show-toast', handleToastEvent);
      if (timer) clearTimeout(timer);
    };
  }, []);

  React.useEffect(() => {
    const pageTitles = {
      home: 'Smart Sight',
      about: 'About',
      login: 'Login',
      forgot_password: 'Forgot Password',
      detection: 'Detection',
      cameras: 'Cameras',
      dataset: 'Dataset',
      reports: 'Reports',
      notifications: 'Notification Alerts',
    };
    document.title = pageTitles[activePage] || 'Smart Sight';
  }, [activePage]);

  return (
    <div className="d-flex flex-column min-vh-100 position-relative">

      <style>{`
        /* ── Android Push Notification Styling (Matches base.html) ── */
        .android-notification-container {
          position: fixed;
          top: max(68px, calc(env(safe-area-inset-top, 0px) + 64px));
          left: 50%;
          transform: translateX(-50%);
          z-index: 10800;
          width: calc(100vw - 24px);
          max-width: 480px;
          pointer-events: none;
        }

        .android-notification-card {
          pointer-events: auto;
          background: var(--bg-surface-solid, #ffffff) !important;
          border: 1px solid var(--border-color, #e2e8f0) !important;
          border-radius: 16px !important;
          padding: 14px 18px !important;
          padding-right: 48px !important;
          display: flex !important;
          align-items: center !important;
          gap: 14px;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05) !important;
          position: relative;
          animation: androidNotificationSlide 0.45s cubic-bezier(0.18, 0.89, 0.32, 1.28);
        }

        @keyframes androidNotificationSlide {
          from {
            opacity: 0;
            transform: translateY(-25px) scale(0.94);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .android-notif-icon {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          font-size: 1.2rem;
          color: #ffffff;
        }

        .android-notif-icon.bg-success {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important;
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
        }

        .android-notif-icon.bg-error,
        .android-notif-icon.bg-danger {
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%) !important;
          box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
        }

        .android-notif-icon.bg-info {
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%) !important;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
        }

        .android-notif-body {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
          flex-grow: 1;
        }

        .android-notif-title {
          font-weight: 700;
          font-size: 0.72rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #2563eb;
        }

        .android-notif-msg {
          font-size: 0.84rem;
          font-weight: 600;
          color: var(--text-heading, #0f172a);
          line-height: 1.35;
          word-break: normal;
          overflow-wrap: anywhere;
          white-space: pre-line;
        }

        .android-notif-close {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: transparent;
          border: none;
          color: var(--text-muted, #64748b);
          opacity: 0.65;
          font-size: 0.85rem;
          padding: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          border-radius: 50%;
          transition: all 0.2s ease;
        }

        .android-notif-close:hover {
          opacity: 1;
          background: rgba(0, 0, 0, 0.06);
          color: var(--text-heading, #0f172a);
        }
      `}</style>

      {/* Global Android Push Notification Banner (Matches base.html) */}
      {toast && (
        <div className="android-notification-container">
          <div className="android-notification-card">
            <div className={`android-notif-icon bg-${toast.type}`}>
              {toast.type === 'success' ? (
                <i className="bi bi-check2"></i>
              ) : toast.type === 'error' || toast.type === 'danger' ? (
                <i className="bi bi-exclamation-circle"></i>
              ) : (
                <i className="bi bi-info-circle"></i>
              )}
            </div>
            <div className="android-notif-body">
              <span className="android-notif-title">{toast.title}</span>
              <span className="android-notif-msg">{toast.message}</span>
            </div>
            <button
              type="button"
              className="android-notif-close"
              onClick={() => setToast(null)}
              aria-label="Close"
            >
              <i className="bi bi-x-lg"></i>
            </button>
          </div>
        </div>
      )}

      {/* Background is now solid per the new theme */}

      <Navbar
        activePage={activePage}
        setActivePage={setActivePage}
        onOpenCapturesModal={() => setShowCapturesModal(true)}
        user={user}
        setUser={setUser}
      />

      <main className="flex-grow-1 overflow-x-hidden">
        <div key={activePage} className="page-transition-container">
          <Routes>
            <Route path="/" element={<HomePage setActivePage={setActivePage} />} />
            <Route path="/home" element={<HomePage setActivePage={setActivePage} />} />
            <Route path="/about" element={<AboutPage />} />
            <Route
              path="/login"
              element={user ? <Navigate to="/" replace /> : <LoginPage setActivePage={setActivePage} setUser={setUser} />}
            />
            <Route
              path="/forgot_password"
              element={user ? <Navigate to="/" replace /> : <ForgotPasswordPage setActivePage={setActivePage} />}
            />
            <Route
              path="/detection"
              element={user ? <DetectionPage onOpenCapturesModal={() => setShowCapturesModal(true)} /> : <Navigate to="/login" replace />}
            />
            <Route
              path="/cameras"
              element={user ? <CamerasPage /> : <Navigate to="/login" replace />}
            />
            <Route
              path="/dataset"
              element={user ? <DatasetPage /> : <Navigate to="/login" replace />}
            />
            <Route
              path="/reports"
              element={user ? <ReportsPage /> : <Navigate to="/login" replace />}
            />
            <Route
              path="/notifications"
              element={user ? <NotificationsPage setActivePage={setActivePage} user={user} /> : <Navigate to="/login" replace />}
            />
            <Route
              path="/admin"
              element={user ? <AdminPanelPage /> : <Navigate to="/login" replace />}
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>

      <Footer setActivePage={setActivePage} />

      <UnknownCapturesModal
        show={showCapturesModal}
        onClose={() => setShowCapturesModal(false)}
      />
    </div>
  );
}
