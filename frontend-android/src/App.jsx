import React, { useState } from 'react';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ParticleBackground from './components/ParticleBackground';
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
import appFavicon from './assets/app-load.png';

const VALID_PAGES = ['home', 'about', 'login', 'forgot_password', 'detection', 'cameras', 'dataset', 'reports', 'notifications'];

const getPageFromPath = () => {
  const path = window.location.pathname.replace(/^\/+|\/+$/g, '');
  if (!path) return 'home';
  return VALID_PAGES.includes(path) ? path : 'home';
};

export default function App() {
  const [activePage, setActivePageState] = useState(getPageFromPath);
  const [showCapturesModal, setShowCapturesModal] = useState(false);
  const [appLoading, setAppLoading] = useState(true);
  const [fadeOutLoading, setFadeOutLoading] = useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setFadeOutLoading(true);
      const hideTimer = setTimeout(() => setAppLoading(false), 400);
      return () => clearTimeout(hideTimer);
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  const setActivePage = (newPage) => {
    setActivePageState(newPage);
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    const newPath = newPage === 'home' ? '/' : `/${newPage}`;
    if (window.location.pathname !== newPath) {
      window.history.pushState({ page: newPage }, '', newPath);
    }
  };

  React.useEffect(() => {
    const handlePopState = () => {
      setActivePageState(getPageFromPath());
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
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
          const API = (await import('./api/axios')).default;
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
              try { setUser(JSON.parse(saved)); } catch (e) { }
            }
          }
        }
      }
    };
    fetchCurrentUser();

    // Firebase Push Notifications Setup (FCM Native Only)
    const setupNotifications = async () => {
      try {
        const { initFirebasePush } = await import('./utils/firebasePush');
        await initFirebasePush();
      } catch (e) {
        console.warn('Firebase push init skipped:', e);
      }
    };
    setupNotifications();

    const setupStatusBar = async () => {
      try {
        if (window.Capacitor) {
          const { StatusBar, Style } = await import('@capacitor/status-bar');
          await StatusBar.setOverlaysWebView({ overlay: false });
          await StatusBar.setStyle({ style: Style.Dark });
          await StatusBar.setBackgroundColor({ color: '#000000' });
        }
      } catch (e) {
        console.warn('StatusBar init skipped:', e);
      }
    };
    setupStatusBar();
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
      {/* Premium Glassmorphic App Splash / Boot Screen */}
      {appLoading && (
        <div
          className="app-boot-splash"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999999,
            background: `
              radial-gradient(at 5% 5%, rgba(30, 86, 160, 0.45) 0px, transparent 55%),
              radial-gradient(at 95% 5%, rgba(59, 130, 246, 0.40) 0px, transparent 55%),
              radial-gradient(at 50% 50%, rgba(56, 189, 248, 0.35) 0px, transparent 60%),
              radial-gradient(at 5% 95%, rgba(125, 211, 252, 0.40) 0px, transparent 55%),
              radial-gradient(at 95% 95%, rgba(2, 132, 199, 0.40) 0px, transparent 55%),
              linear-gradient(135deg, rgba(30, 86, 160, 0.12) 0%, rgba(2, 132, 199, 0.12) 100%),
              #f8fafc
            `,
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'opacity 0.45s cubic-bezier(0.4, 0, 0.2, 1)',
            opacity: fadeOutLoading ? 0 : 1,
            pointerEvents: fadeOutLoading ? 'none' : 'all',
          }}
        >
          <style>{`
            @keyframes pulseRing {
              0% { transform: scale(0.95); opacity: 0.85; filter: drop-shadow(0 4px 12px rgba(13, 110, 253, 0.25)); }
              50% { transform: scale(1.05); opacity: 1; filter: drop-shadow(0 12px 28px rgba(13, 110, 253, 0.5)); }
              100% { transform: scale(0.95); opacity: 0.85; filter: drop-shadow(0 4px 12px rgba(13, 110, 253, 0.25)); }
            }
            @keyframes rotateSpinner {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
          <div
            className="text-center p-5 rounded-4 shadow-lg border"
            style={{
              background: 'rgba(255, 255, 255, 0.65)',
              backdropFilter: 'blur(24px) saturate(180%)',
              WebkitBackdropFilter: 'blur(24px) saturate(180%)',
              borderColor: 'rgba(255, 255, 255, 0.8)',
              maxWidth: '400px',
              width: '92%',
            }}
          >
            <div className="mb-3 d-inline-block position-relative" style={{ width: '130px', height: '130px' }}>
              <img
                src={appFavicon}
                alt="Smart Sight App Logo"
                className="w-100 h-100 object-fit-contain"
                style={{
                  animation: 'pulseRing 2.2s ease-in-out infinite',
                }}
              />
            </div>
            <h3 className="fw-bold mb-1" style={{ color: '#0f172a', fontFamily: 'var(--font-heading)', letterSpacing: '-0.03em' }}>
              Smart <span style={{ color: '#0d6efd' }}>Sight</span>
            </h3>
            <p className="text-secondary small mb-3 font-monospace" style={{ fontSize: '0.7rem', letterSpacing: '1.5px', textTransform: 'uppercase', opacity: 0.8 }}>
              Initializing Security Core...
            </p>
            {/* Small loading spinner below text */}
            <div className="d-flex justify-content-center align-items-center">
              <div
                className="spinner-border text-primary"
                role="status"
                style={{ width: '1.35rem', height: '1.35rem', borderWidth: '2.5px' }}
              >
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        /* ── Android Push Notification Styling (Matches base.html) ── */
        .android-notification-container {
          position: fixed;
          top: 75px;
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
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid var(--border-color, rgba(0,0,0,0.12)) !important;
          border-radius: 22px !important;
          padding: 14px 18px !important;
          padding-right: 48px !important;
          display: flex !important;
          align-items: center !important;
          gap: 14px;
          box-shadow: 0 14px 40px rgba(0, 0, 0, 0.25) !important;
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
          color: #0d6efd;
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

      {/* Global 60 FPS Fluid Moving Mesh Gradient Background */}
      <ParticleBackground />

      <Navbar
        activePage={activePage}
        setActivePage={setActivePage}
        onOpenCapturesModal={() => setShowCapturesModal(true)}
        user={user}
        setUser={setUser}
      />

      <main className="flex-grow-1 overflow-x-hidden">
        <div key={activePage} className="page-transition-container">
          {activePage === 'home' && <HomePage setActivePage={setActivePage} />}
          {activePage === 'about' && <AboutPage />}
          {activePage === 'login' && <LoginPage setActivePage={setActivePage} setUser={setUser} />}
          {activePage === 'forgot_password' && <ForgotPasswordPage setActivePage={setActivePage} />}
          {activePage === 'detection' && <DetectionPage onOpenCapturesModal={() => setShowCapturesModal(true)} />}
          {activePage === 'cameras' && <CamerasPage />}
          {activePage === 'dataset' && <DatasetPage />}
          {activePage === 'reports' && <ReportsPage />}
          {activePage === 'notifications' && <NotificationsPage setActivePage={setActivePage} user={user} />}
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
