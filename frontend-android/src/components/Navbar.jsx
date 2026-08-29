import React, { useState, useEffect, useRef } from 'react';
import API from '../api/axios';
import { syncThemeAndStatusBar } from '../utils/themeStatusBar';

export default function Navbar({ activePage, setActivePage, user, setUser }) {
  const hasToken = !!localStorage.getItem('access_token');
  const isAuthenticated = hasToken || !!user;
  const isStaff = isAuthenticated && (user ? (user.is_staff ?? true) : true);
  const displayName = user?.username ? user.username : (user?.first_name ? user.first_name : 'User');

  const handleLogout = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const logoutName = displayName || 'User';
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    if (setUser) setUser(null);
    setShowUserDropdown(false);
    if (window.showToast) {
      window.showToast(`Logged out successfully.\nGoodbye ${logoutName}!`, 'info', 'LOGOUT');
    }
    setActivePage('login');
  };

  // Dynamic Theme (Light / Dark / System Auto)
  const [themeMode, setThemeMode] = useState(() => {
    const saved = localStorage.getItem('theme_mode') || localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
    return 'system';
  });

  const [resolvedTheme, setResolvedTheme] = useState(() => {
    const saved = localStorage.getItem('theme_mode') || localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

    const applyTheme = () => {
      let active = themeMode;
      if (themeMode === 'system') {
        active = mediaQuery && mediaQuery.matches ? 'dark' : 'light';
      }
      setResolvedTheme(active);
      syncThemeAndStatusBar(active);
      localStorage.setItem('theme_mode', themeMode);
      localStorage.setItem('theme', active);
    };

    applyTheme();

    const handleChange = () => {
      if (themeMode === 'system') {
        applyTheme();
      }
    };

    if (mediaQuery) {
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
      } else if (mediaQuery.addListener) {
        mediaQuery.addListener(handleChange);
        return () => mediaQuery.removeListener(handleChange);
      }
    }
  }, [themeMode]);

  const cycleTheme = () => {
    setThemeMode(prev => {
      if (prev === 'light') return 'dark';
      if (prev === 'dark') return 'system';
      return 'light';
    });
  };

  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const lastNotifiedIdRef = useRef(null);

  useEffect(() => {
    const fetchUnread = async () => {
      if (document.hidden) return;
      try {
        const res = await API.get('/notifications/');
        const notifs = res.data.notifications || [];
        const count = typeof res.data.unread_count === 'number'
          ? res.data.unread_count
          : notifs.filter(n => n.status === 'PENDING' && !n.is_read).length;
        setUnreadCount(count);
      } catch (err) {
        // Silent catch
      }
    };
    fetchUnread();
    window.addEventListener('refresh-notifications', fetchUnread);
    const interval = setInterval(fetchUnread, 15000);
    return () => {
      window.removeEventListener('refresh-notifications', fetchUnread);
      clearInterval(interval);
    };
  }, []);

  // Sliding Liquid Pill Logic
  const [hoveredPage, setHoveredPage] = useState(null);
  const [pillStyle, setPillStyle] = useState({ left: 0, width: 0, height: 0, top: 0, opacity: 0 });
  const [isMoving, setIsMoving] = useState(false);
  const navContainerRef = useRef(null);
  const navItemRefs = useRef({});

  const currentTab = hoveredPage || activePage;

  useEffect(() => {
    const updatePill = () => {
      const activeEl = navItemRefs.current[currentTab];
      const containerEl = navContainerRef.current;
      if (activeEl && containerEl) {
        const containerRect = containerEl.getBoundingClientRect();
        const activeRect = activeEl.getBoundingClientRect();
        setIsMoving(true);
        const timer = setTimeout(() => setIsMoving(false), 320);

        setPillStyle({
          left: `${activeRect.left - containerRect.left}px`,
          width: `${activeRect.width}px`,
          height: `${activeRect.height}px`,
          top: `${activeRect.top - containerRect.top}px`,
          opacity: 1
        });

        return () => clearTimeout(timer);
      }
    };

    updatePill();
    window.addEventListener('resize', updatePill);
    return () => window.removeEventListener('resize', updatePill);
  }, [currentTab, isStaff, activePage]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.dropdown')) {
        setShowUserDropdown(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const closeMobileNav = () => {
    const navEl = document.getElementById('navbarNav');
    if (navEl && navEl.classList.contains('show')) {
      navEl.classList.remove('show');
      const toggler = document.querySelector('.navbar-toggler');
      if (toggler) {
        toggler.setAttribute('aria-expanded', 'false');
        toggler.classList.add('collapsed');
      }
    }
  };

  return (
    <>
      <style>{`
        /* ── Solid Status Bar Scrim (100% Opaque Native Status Bar Background) ── */
        .status-bar-solid-scrim {
          position: sticky;
          top: 0;
          left: 0;
          width: 100%;
          height: var(--status-bar-height, env(safe-area-inset-top, 0px));
          background: #ffffff !important;
          z-index: 1060;
          transition: background 0.2s ease;
        }

        [data-bs-theme="dark"] .status-bar-solid-scrim {
          background: #0b0f19 !important;
        }

        /* ── 100% Solid Opaque Navbar (No Transparency / No Blur) ── */
        .navbar {
          position: sticky;
          top: var(--status-bar-height, env(safe-area-inset-top, 0px)) !important;
          width: 100%;
          margin: 0;
          border-radius: 0 !important;
          background: #ffffff !important;
          border-bottom: 1px solid #e2e8f0 !important;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
          z-index: 1050;
          transition: background 0.2s ease, border-color 0.2s ease;
          padding-top: 0.5rem !important;
          padding-bottom: 0.5rem !important;
          padding-left: 0 !important;
          padding-right: 0 !important;
          min-height: 52px;
        }

        [data-bs-theme="dark"] .navbar {
          background: #0b0f19 !important;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
        }

        /* ── Frameless Big Bell Button for Mobile ── */
        .mobile-bell-btn {
          width: 44px !important;
          height: 44px !important;
          min-width: 44px !important;
          max-width: 44px !important;
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          padding: 0 !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          outline: none !important;
          position: relative;
          color: #2563eb !important;
          transition: transform 0.15s cubic-bezier(0.16, 1, 0.3, 1) !important;
        }

        .mobile-bell-btn:active {
          transform: scale(0.88) !important;
        }

        /* ── Mobile Header Menu Button (44px Squircle) ── */
        .mobile-nav-btn,
        .navbar-toggler.mobile-nav-btn {
          width: 44px !important;
          height: 44px !important;
          min-width: 44px !important;
          max-width: 44px !important;
          border-radius: 13px !important;
          border: 1.5px solid var(--border-color, #e2e8f0) !important;
          background: var(--bg-surface-solid, #ffffff) !important;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06) !important;
          padding: 0 !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          color: #2563eb !important;
          transition: transform 0.15s cubic-bezier(0.16, 1, 0.3, 1), background 0.15s ease, border-color 0.15s ease !important;
          outline: none !important;
          position: relative;
        }

        .mobile-nav-btn:hover,
        .navbar-toggler.mobile-nav-btn:hover {
          border-color: #2563eb !important;
          color: #2563eb !important;
        }

        .mobile-nav-btn:active,
        .navbar-toggler.mobile-nav-btn:active {
          transform: scale(0.92) !important;
          background: var(--bg-surface-hover, #f1f5f9) !important;
        }

        .mobile-nav-btn:focus,
        .navbar-toggler.mobile-nav-btn:focus {
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.25) !important;
        }

        [data-bs-theme="dark"] .mobile-nav-btn,
        [data-bs-theme="dark"] .navbar-toggler.mobile-nav-btn {
          background: #111827 !important;
          border-color: rgba(255, 255, 255, 0.12) !important;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3) !important;
        }

        .navbar-brand {
          font-family: var(--font-brand) !important;
          font-weight: var(--fw-bold, 700);
          letter-spacing: var(--ls-heading, -0.03em);
        }

        .nav-link {
          font-size: var(--fs-nav, 0.8125rem);
          font-weight: var(--fw-semibold, 600);
          text-transform: uppercase;
          letter-spacing: var(--ls-nav, 0.06em);
          padding: 0.45rem 1rem;
          border-radius: 999px;
          color: var(--nav-link-color, rgba(255, 255, 255, 0.65)) !important;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          border: 1px solid transparent;
        }

        @media (min-width: 992px) {
          .nav-link::after,
          .nav-link::before {
            display: none !important;
          }

          .nav-link:hover {
            color: var(--nav-link-hover, #ffffff) !important;
            background: rgba(255, 255, 255, 0.06);
          }

          .nav-item.active .nav-link {
            color: #2563eb !important;
            background: rgba(13, 110, 253, 0.12);
            border-color: rgba(13, 110, 253, 0.25);
            font-weight: 700;
          }

          [data-bs-theme="light"] .nav-link:hover {
            color: var(--text-heading) !important;
            background: rgba(15, 23, 42, 0.05);
          }

          [data-bs-theme="light"] .nav-item.active .nav-link {
            color: #2563eb !important;
            background: rgba(13, 110, 253, 0.1);
            border-color: rgba(13, 110, 253, 0.2);
          }
        }

        /* Disable underline for pill buttons */
        .rounded-pill.nav-link::after {
          display: none;
        }

        @media (max-width: 991.98px) {
          .mobile-nav-link {
            display: flex;
            align-items: center;
            gap: 0.8rem;
            padding: 0.65rem 1rem;
            margin: 0.15rem 0;
            border-radius: 12px;
            font-size: 0.88rem;
            font-weight: 600;
            letter-spacing: -0.01em;
            color: var(--text-secondary) !important;
            text-decoration: none !important;
            transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
            border: 1px solid transparent;
          }

          .mobile-nav-link i.mobile-icon {
            font-size: 1.15rem;
            color: var(--text-secondary);
            transition: all 0.2s ease;
            width: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .mobile-nav-link:hover,
          .mobile-nav-link.active {
            background: rgba(13, 110, 253, 0.08) !important;
            color: #2563eb !important;
            font-weight: 700;
            transform: translateX(3px);
          }

          .mobile-nav-link.active i.mobile-icon,
          .mobile-nav-link:hover i.mobile-icon {
            color: #2563eb !important;
            transform: scale(1.05);
          }

          .frosted-signout-btn {
            transition: all 0.25s ease !important;
          }

          .frosted-signout-btn:hover {
            background: #bb2d3b !important;
            border-color: #b02a37 !important;
            color: #ffffff !important;
            transform: translateY(-1px);
            box-shadow: 0 4px 14px rgba(220, 53, 69, 0.4) !important;
          }

          .navbar-toggler {
            border: 1px solid var(--border-color) !important;
            background-color: var(--bg-surface-solid) !important;
            border-radius: 12px !important;
            padding: 0.45rem 0.65rem !important;
            transition: transform 0.2s ease !important;
          }

          .navbar-toggler:active {
            transform: scale(0.94);
          }
        }

        /* ══════════════════════════════════════════════════════
           FROSTED NAV BUTTONS (THEME & LOGIN) & DROPDOWN MENUS
           ══════════════════════════════════════════════════════ */
        .theme-toggle-btn {
          width: 40px;
          height: 40px;
          border-radius: 50% !important;
          border: 1px solid var(--border-color);
          background: var(--bg-surface-solid) !important;
          box-shadow: var(--shadow-xs, 0 1px 2px rgba(0, 0, 0, 0.05));
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          color: var(--text-heading) !important;
          position: relative;
          overflow: visible;
          flex-shrink: 0;
        }

        .theme-toggle-btn:hover {
          border-color: var(--color-primary, #2563eb);
          background: var(--bg-surface-hover) !important;
          color: var(--color-primary, #2563eb) !important;
          transform: scale(1.05);
          box-shadow: var(--shadow-sm, 0 1px 3px rgba(0, 0, 0, 0.08));
        }

        .theme-toggle-btn i {
          font-size: 1.1rem;
          transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease;
        }

        /* Dropdown Menus (Theme Selector & User Account) */
        .dropdown-menu {
          background: var(--dropdown-bg, #ffffff) !important;
          border: 1px solid var(--dropdown-border, #e2e8f0) !important;
          box-shadow: var(--shadow-lg, 0 10px 15px -3px rgba(0, 0, 0, 0.08)) !important;
          border-radius: 12px !important;
        }

        .dropdown-item {
          color: var(--text-body, #1e293b) !important;
          border-radius: 10px !important;
          transition: all 0.2s ease !important;
        }

        .dropdown-item:hover {
          background-color: var(--dropdown-hover, #f1f5f9) !important;
          color: var(--text-heading, #0f172a) !important;
        }

        .dropdown-header {
          color: var(--text-secondary, #334155) !important;
        }

        #themeDropdownMenu .dropdown-item.active {
          background-color: rgba(13, 110, 253, 0.12) !important;
          color: #2563eb !important;
        }

        /* ── Organic Liquid Pill Indicator ── */
        .nav-liquid-pill {
          background: rgba(13, 110, 253, 0.25) !important;
          border: 1px solid rgba(13, 110, 253, 0.5) !important;
          box-shadow: 0 0 20px rgba(13, 110, 253, 0.3) !important;
          pointer-events: none;
        }

        [data-bs-theme="light"] .nav-liquid-pill {
          background: rgba(13, 110, 253, 0.12) !important;
          border: 1px solid rgba(13, 110, 253, 0.35) !important;
          box-shadow: 0 4px 16px rgba(13, 110, 253, 0.15) !important;
        }

        .nav-link-liquid {
          color: var(--text-secondary) !important;
          font-size: 0.8rem;
          letter-spacing: 0.05em;
          transition: color 0.25s ease;
          z-index: 1;
          position: relative;
          background: transparent !important;
          border: none !important;
          display: block;
        }

        .nav-link-liquid.active-link {
          color: #ffffff !important;
          font-weight: 700;
        }

        [data-bs-theme="light"] .nav-link-liquid.active-link {
          color: #2563eb !important;
        }

        /* ── Light mode navbar toggler icon fix ── */
        [data-bs-theme="light"] .navbar-toggler-icon {
          filter: invert(0) !important;
          background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 30'%3e%3cpath stroke='rgba(15, 23, 42, 0.6)' stroke-linecap='round' stroke-miterlimit='10' stroke-width='2' d='M4 7h22M4 15h22M4 23h22'/%3e%3c/svg%3e") !important;
        }

        /* ── Mobile Nav Collapse (Seamless Unified Header Extension) ── */
        @media (max-width: 991.98px) {
          #navbarNav.collapse.show,
          #navbarNav.collapsing {
            background: transparent !important;
            border: none !important;
            border-top: 1px solid var(--border-color, #e2e8f0) !important;
            margin-top: 0.6rem !important;
            padding: 0.6rem 0 0.5rem 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
          }
          [data-bs-theme="dark"] #navbarNav.collapse.show,
          [data-bs-theme="dark"] #navbarNav.collapsing {
            border-top-color: rgba(255, 255, 255, 0.08) !important;
          }
        }

        /* ── User Profile Pill ── */
        .user-profile-pill {
          display: inline-flex;
          align-items: center;
          gap: 0.55rem;
          padding: 0.28rem 0.75rem 0.28rem 0.28rem;
          border-radius: 999px;
          background: var(--bg-surface-solid) !important;
          border: 1px solid var(--border-color) !important;
          text-decoration: none !important;
          transition: all 0.25s ease !important;
          cursor: pointer;
        }

        .user-profile-pill:hover,
        .user-profile-pill.show {
          border-color: rgba(13, 110, 253, 0.45) !important;
          box-shadow: 0 4px 16px rgba(13, 110, 253, 0.12) !important;
          text-decoration: none !important;
        }

        .user-profile-pill::after {
          display: none !important;
        }

        .user-avatar-circle {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #2563eb;
          box-shadow: 0 2px 8px rgba(13, 110, 253, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          font-size: 0.8rem;
          font-weight: 800;
          color: #fff;
          letter-spacing: 0.02em;
        }

        .user-name-text {
          font-size: 0.82rem;
          font-weight: 700;
          letter-spacing: 0.03em;
          color: var(--text-heading);
          line-height: 1;
        }
      `}</style>
      {/* 100% Solid Opaque Status Bar Scrim */}
      <div className="status-bar-solid-scrim" />
      <nav className="navbar navbar-expand-lg sticky-top">
        <div className="container">
          <a
            className="navbar-brand text-dynamic fw-bold"
            href="#"
            onClick={(e) => { e.preventDefault(); setActivePage('home'); closeMobileNav(); }}
          >
            Smart <span style={{ color: '#2563eb' }}>Sight</span>
          </a>

          <div className="d-flex align-items-center ms-auto d-lg-none" style={{ gap: '8px' }}>
            {/* Notification Bell Icon for Mobile Header (Frameless & Big) */}
            <button
              type="button"
              className="mobile-bell-btn"
              onClick={(e) => { e.preventDefault(); setActivePage('notifications'); closeMobileNav(); }}
              title="Notifications"
              aria-label="View notifications"
            >
              <i className="bi bi-bell-fill" style={{ fontSize: '1.85rem', color: '#2563eb', lineHeight: 1 }}></i>
              {unreadCount > 0 && (
                <span
                  className="position-absolute badge rounded-circle bg-danger text-white border border-2 border-white"
                  style={{
                    top: '0px',
                    right: '0px',
                    width: '18px',
                    height: '18px',
                    minWidth: '18px',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.62rem',
                    fontWeight: '800',
                    lineHeight: '1',
                    boxShadow: '0 2px 6px rgba(220, 53, 69, 0.4)',
                    zIndex: 10
                  }}
                >
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {/* Mobile Hamburger Menu Toggle Button */}
            <button
              className="navbar-toggler mobile-nav-btn"
              type="button"
              data-bs-toggle="collapse"
              data-bs-target="#navbarNav"
              aria-controls="navbarNav"
              aria-expanded="false"
              aria-label="Toggle navigation"
            >
              <i className="bi bi-list" style={{ fontSize: '1.65rem', color: '#2563eb', lineHeight: 1 }}></i>
            </button>
          </div>

          <div className="collapse navbar-collapse" id="navbarNav">
            {/* Main Links (Centered with Organic Liquid Morphing Indicator) */}
            <ul
              ref={navContainerRef}
              className="navbar-nav position-absolute start-50 translate-middle-x d-none d-lg-flex align-items-center p-0 m-0"
              onMouseLeave={() => setHoveredPage(null)}
              style={{ gap: '6px' }}
            >
              {/* Organic Liquid Blob Pill */}
              <div
                className="nav-liquid-pill position-absolute rounded-pill"
                style={{
                  left: pillStyle.left,
                  width: pillStyle.width,
                  height: pillStyle.height,
                  top: pillStyle.top,
                  opacity: pillStyle.opacity,
                  transition: 'left 0.38s cubic-bezier(0.34, 1.45, 0.64, 1), width 0.35s cubic-bezier(0.34, 1.45, 0.64, 1), transform 0.3s ease, opacity 0.2s ease',
                  transform: isMoving ? 'scaleX(1.15) scaleY(0.88)' : 'scaleX(1) scaleY(1)',
                  pointerEvents: 'none'
                }}
              />

              {[
                { id: 'home', label: 'Home' },
                { id: 'detection', label: 'Detection' },
                ...(isStaff ? [
                  { id: 'cameras', label: 'Cameras' },
                  { id: 'dataset', label: 'Dataset' },
                  { id: 'reports', label: 'Reports' },
                  { id: 'notifications', label: 'Alerts' }
                ] : []),
                { id: 'about', label: 'About Us' }
              ].map((item) => {
                const isActive = (hoveredPage ? hoveredPage === item.id : activePage === item.id);
                return (
                  <li
                    key={item.id}
                    ref={el => navItemRefs.current[item.id] = el}
                    className="nav-item m-0"
                    onMouseEnter={() => setHoveredPage(item.id)}
                  >
                    <a
                      className={`nav-link nav-link-liquid px-3.5 py-1.5 rounded-pill text-uppercase fw-bold d-inline-flex align-items-center gap-1.5 position-relative ${isActive ? 'active-link' : ''}`}
                      href="#"
                      onClick={(e) => { e.preventDefault(); setActivePage(item.id); closeMobileNav(); }}
                      style={item.id === 'notifications' && unreadCount > 0 ? { paddingRight: '16px' } : {}}
                    >
                      <span>{item.label}</span>
                      {item.id === 'notifications' && unreadCount > 0 && (
                        <span
                          className="position-absolute badge rounded-circle bg-danger text-white border border-2 border-white"
                          style={{
                            top: '-3px',
                            right: '0px',
                            width: '20px',
                            height: '20px',
                            minWidth: '20px',
                            padding: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.65rem',
                            fontWeight: '800',
                            lineHeight: '1',
                            boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
                            zIndex: 10
                          }}
                        >
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </a>
                  </li>
                );
              })}
            </ul>

            {/* Minimal Mobile Navigation Links (< 992px) */}
            <ul className="navbar-nav d-lg-none mt-1 mb-1 p-0">
              {[
                { id: 'home', label: 'Home', icon: 'bi-house-door-fill' },
                { id: 'detection', label: 'Detection', icon: 'bi-eye-fill' },
                ...(isStaff ? [
                  { id: 'cameras', label: 'Cameras', icon: 'bi-camera-video-fill' },
                  { id: 'dataset', label: 'Dataset', icon: 'bi-database-fill-gear' },
                  { id: 'reports', label: 'Reports', icon: 'bi-bar-chart-fill' },
                  { id: 'notifications', label: 'Alerts', icon: 'bi-bell-fill' }
                ] : []),
                { id: 'about', label: 'About Us', icon: 'bi-info-circle-fill' }
              ].map(item => (
                <li key={item.id} className="nav-item">
                  <a
                    className={`mobile-nav-link ${activePage === item.id ? 'active' : ''}`}
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setActivePage(item.id);
                      closeMobileNav();
                    }}
                  >
                    <i className={`bi ${item.icon} mobile-icon`}></i>
                    <span className="flex-grow-1">{item.label}</span>
                    {item.id === 'notifications' && unreadCount > 0 && (
                      <span className="badge rounded-circle bg-danger text-white" style={{
                        fontSize: '0.65rem',
                        width: '20px',
                        height: '20px',
                        minWidth: '20px',
                        padding: 0,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        lineHeight: '1',
                        fontWeight: '800',
                        flexShrink: 0
                      }}>
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </a>
                </li>
              ))}
            </ul>

            {/* Mobile Footer with Theme Toggle (< 992px) */}
            <div className="d-lg-none pt-2 border-top border-secondary border-opacity-25">
              <div className="d-flex align-items-center justify-content-between mb-3 px-1">
                <span className="small text-secondary fw-semibold">Appearance</span>
                <button
                  type="button"
                  className="btn btn-sm d-flex align-items-center gap-2 rounded-pill px-3 py-1.5"
                  onClick={cycleTheme}
                  style={{
                    background: 'var(--bg-surface-solid)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-heading)',
                    fontSize: '0.8rem',
                    fontWeight: 600
                  }}
                >
                  {themeMode === 'system' ? (
                    <>
                      <i className="bi bi-circle-half" style={{ color: '#2563eb' }}></i>
                      <span>Auto ({resolvedTheme === 'dark' ? 'Dark' : 'Light'})</span>
                    </>
                  ) : themeMode === 'dark' ? (
                    <>
                      <i className="bi bi-moon-stars-fill" style={{ color: '#2563eb' }}></i>
                      <span>Dark Mode</span>
                    </>
                  ) : (
                    <>
                      <i className="bi bi-sun-fill text-warning"></i>
                      <span>Light Mode</span>
                    </>
                  )}
                </button>
              </div>
              {isAuthenticated ? (
                <div className="p-3 rounded-4 d-flex align-items-center justify-content-between" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)' }}>
                  <div className="d-flex align-items-center" style={{ gap: '10px', minWidth: 0 }}>
                    <div className="user-avatar-circle" style={{ width: '36px', height: '36px', fontSize: '0.85rem', flexShrink: 0 }}>
                      {displayName ? displayName.charAt(0).toUpperCase() : <i className="bi bi-person-fill"></i>}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div className="fw-bold text-dynamic text-truncate" style={{ fontSize: '0.85rem', lineHeight: '1.2' }}>{displayName}</div>
                      <div className="text-secondary text-truncate" style={{ fontSize: '0.7rem' }}>{isStaff ? 'Administrator' : 'User Account'}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-danger rounded-pill fw-bold d-inline-flex align-items-center justify-content-center frosted-signout-btn shadow-sm"
                    onClick={(e) => { handleLogout(e); closeMobileNav(); }}
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: '0.8rem',
                      fontWeight: '600',
                      letterSpacing: '0.02em',
                      flexShrink: 0,
                      padding: '8px 16px',
                      gap: '6px',
                      background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                      border: 'none',
                      color: '#ffffff',
                      boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
                      lineHeight: '1'
                    }}
                  >
                    <i className="bi bi-box-arrow-right" style={{ fontSize: '0.9rem', lineHeight: '1' }}></i>
                    <span>Sign Out</span>
                  </button>
                </div>
              ) : (
                <div className="d-flex justify-content-center pt-1 pb-1">
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); setActivePage('login'); closeMobileNav(); }}
                    className="btn btn-primary rounded-pill px-4 py-2 fw-bold text-uppercase d-inline-flex align-items-center justify-content-center shadow-sm hover-scale"
                    style={{
                      fontSize: '0.8rem',
                      letterSpacing: '0.04em',
                      gap: '6px'
                    }}
                  >
                    <i className="bi bi-box-arrow-in-right" style={{ fontSize: '0.95rem' }}></i>
                    <span>Login</span>
                  </button>
                </div>
              )}
            </div>

            {/* Right Side Items for Desktop (>= 992px) */}
            <ul className="navbar-nav ms-auto d-none d-lg-flex align-items-center gap-2">
              <li className="nav-item">
                <button
                  type="button"
                  className="theme-toggle-btn"
                  onClick={cycleTheme}
                  title={themeMode === 'system' ? `Theme: Auto/System (Currently ${resolvedTheme})` : themeMode === 'dark' ? 'Theme: Dark Mode' : 'Theme: Light Mode'}
                  aria-label="Toggle Theme"
                >
                  {themeMode === 'system' ? (
                    <i className="bi bi-circle-half" style={{ color: '#2563eb' }}></i>
                  ) : themeMode === 'dark' ? (
                    <i className="bi bi-moon-stars-fill" style={{ color: '#2563eb' }}></i>
                  ) : (
                    <i className="bi bi-sun-fill text-warning"></i>
                  )}
                </button>
              </li>

              {isAuthenticated ? (
                <li className="nav-item dropdown position-relative">
                  <a
                    className={`user-profile-pill ${showUserDropdown ? 'show' : ''}`}
                    href="#"
                    id="userDropdown"
                    role="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowUserDropdown(!showUserDropdown); }}
                  >
                    <div className="user-avatar-circle">
                      {displayName ? displayName.charAt(0).toUpperCase() : <i className="bi bi-person-fill"></i>}
                    </div>
                    <span className="user-name-text">{displayName}</span>
                  </a>
                  <ul className={`dropdown-menu dropdown-menu-end shadow-lg py-3 mt-2 ${showUserDropdown ? 'show' : ''}`} aria-labelledby="userDropdown" style={{ position: 'absolute', right: 0, minWidth: '200px', zIndex: 1100, background: 'var(--dropdown-bg)', border: '1px solid var(--dropdown-border)', borderRadius: '16px', }}>
                    <li>
                      <h6 className="dropdown-header small text-uppercase fw-bold text-center mb-2" style={{ color: 'var(--text-secondary)' }}>{user?.username ? `Account: ${user.username}` : 'User Account'}</h6>
                    </li>
                    <li>
                      <hr className="dropdown-divider opacity-25 mx-3" style={{ borderColor: 'var(--border-color)' }} />
                    </li>
                    {isStaff && (
                      <li>
                        <a className="dropdown-item d-flex align-items-center gap-3 py-2 px-3" style={{ color: 'var(--text-body)' }} href="#" onClick={() => closeMobileNav()}>
                          <i className="bi bi-speedometer2 text-primary"></i>
                          <span>Admin Panel</span>
                        </a>
                      </li>
                    )}
                    <li>
                      <a className="dropdown-item d-flex align-items-center gap-3 py-2 px-3" style={{ color: 'var(--text-body)' }} href="#" onClick={(e) => { handleLogout(e); closeMobileNav(); }}>
                        <i className="bi bi-box-arrow-right text-danger"></i>
                        <span>Sign Out</span>
                      </a>
                    </li>
                  </ul>
                </li>
              ) : (
                <li className="nav-item ms-lg-2">
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); setActivePage('login'); closeMobileNav(); }}
                    className="btn btn-primary rounded-pill px-4 py-2 fw-bold text-uppercase d-flex align-items-center gap-2 text-decoration-none shadow-sm transition-all"
                    style={{ fontSize: '0.8rem', letterSpacing: '0.05em' }}
                  >
                    <i className="bi bi-box-arrow-in-right fs-6"></i>
                    <span>Login</span>
                  </button>
                </li>
              )}
            </ul>
          </div>
        </div>
      </nav>
    </>
  );
}
