import React, { useState, useEffect, useRef } from 'react';
import API from '../api/axios';
import ServerConfigModal from './ServerConfigModal';

export default function Navbar({ activePage, setActivePage, user, setUser }) {
  const [showServerModal, setShowServerModal] = useState(false);
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
      document.documentElement.setAttribute('data-bs-theme', active);
      document.documentElement.style.colorScheme = active;
      const meta = document.getElementById('theme-color-meta');
      if (meta) meta.setAttribute('content', active === 'dark' ? '#0b0f19' : '#ffffff');
      localStorage.setItem('theme_mode', themeMode);
      localStorage.setItem('theme', active);

      if (window.electronAPI && typeof window.electronAPI.updateTitleBarTheme === 'function') {
        window.electronAPI.updateTitleBarTheme(active);
      }
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

  useEffect(() => {
    const fetchUnread = async () => {
      if (document.hidden) return;
      if (!localStorage.getItem('access_token')) return; // Do not poll if not logged in
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

  const [isNavOpen, setIsNavOpen] = useState(false);

  const closeMobileNav = () => {
    setIsNavOpen(false);
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
        /* ── 100% Solid Opaque Navbar (Locked Sticky Top / Safe Area Aware) ── */
        .navbar {
          position: sticky;
          top: 0;
          width: 100%;
          margin: 0;
          border-radius: 0 !important;
          background: #ffffff !important;
          border-bottom: 1px solid #e2e8f0 !important;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
          z-index: 1050;
          transition: background 0.2s ease, border-color 0.2s ease;
          padding-top: max(0.4rem, env(safe-area-inset-top, 0px)) !important;
          padding-bottom: 0.4rem !important;
          padding-left: env(safe-area-inset-left, 0px) !important;
          padding-right: env(safe-area-inset-right, 0px) !important;
          min-height: calc(56px + env(safe-area-inset-top, 0px));
        }

        [data-bs-theme="dark"] .navbar {
          background: #0f172a !important;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
        }


        /* ── Mobile Header Action Buttons ── */
        .mobile-bell-btn {
          width: 48px !important;
          height: 48px !important;
          min-width: 48px !important;
          border-radius: 12px !important;
          border: none !important;
          background: transparent !important;
          box-shadow: none !important;
          padding: 0 !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          color: #2563eb !important;
          transition: transform 0.15s ease !important;
          outline: none !important;
          position: relative;
        }

        .mobile-bell-btn:active {
          transform: scale(0.9) !important;
        }

        .mobile-menu-btn,
        .navbar-toggler.mobile-menu-btn {
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
          transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1),
                      background 0.25s ease,
                      border-color 0.25s ease,
                      box-shadow 0.25s ease !important;
          outline: none !important;
          position: relative;
        }

        .mobile-menu-btn:hover {
          border-color: #2563eb !important;
          color: #2563eb !important;
        }

        .mobile-menu-btn:active {
          transform: scale(0.9) !important;
        }

        .mobile-menu-btn.is-active {
          border-color: #2563eb !important;
          background: rgba(37, 99, 235, 0.08) !important;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.18) !important;
          transform: scale(1.02);
        }

        [data-bs-theme="dark"] .mobile-menu-btn {
          background: #111827 !important;
          border-color: rgba(255, 255, 255, 0.12) !important;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3) !important;
        }

        [data-bs-theme="dark"] .mobile-menu-btn.is-active {
          background: rgba(37, 99, 235, 0.18) !important;
          border-color: #2563eb !important;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.28) !important;
        }

        .navbar-brand {
          font-family: var(--font-brand) !important;
          font-weight: var(--fw-bold, 700);
          letter-spacing: var(--ls-heading, -0.03em);
          font-size: 1.45rem !important;
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
            gap: 0.75rem;
            padding: 0.45rem 0.85rem;
            margin: 0.05rem 0;
            border-radius: 10px;
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
            padding: 0 !important;
          }
        }

        /* ── Mobile Login Action Button (Matches LoginPage .btn-auth-primary) ── */
        .mobile-login-btn {
          background: #2563eb !important;
          border: 1px solid rgba(255, 255, 255, 0.12) !important;
          color: #ffffff !important;
          box-shadow: 0 4px 14px rgba(37, 99, 235, 0.3) !important;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
          text-decoration: none !important;
        }

        .mobile-login-btn:hover {
          background: #1d4ed8 !important;
          box-shadow: 0 6px 20px rgba(37, 99, 235, 0.4) !important;
          transform: translateY(-1px);
          color: #ffffff !important;
        }

        .mobile-login-btn:active {
          transform: scale(0.98) !important;
          box-shadow: 0 2px 8px rgba(37, 99, 235, 0.25) !important;
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
          border: 1px solid transparent !important;
          border-radius: 12px !important;
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

        /* ── Mobile Nav Collapse (Only on < 992px) ── */
        @media (max-width: 991.98px) {
          #navbarNav,
          .navbar-collapse#navbarNav {
            display: block !important;
            max-height: 0 !important;
            opacity: 0 !important;
            overflow: hidden !important;
            transform: translateY(-8px) scale(0.99);
            transform-origin: top center;
            transition: max-height 0.35s cubic-bezier(0.25, 1, 0.5, 1),
                        opacity 0.25s ease,
                        transform 0.32s cubic-bezier(0.25, 1, 0.5, 1),
                        margin 0.3s ease,
                        padding 0.3s ease !important;
            margin-top: 0 !important;
            padding: 0 !important;
            border-top: 1px solid transparent !important;
            will-change: max-height, opacity, transform;
          }

          #navbarNav.show,
          .navbar-collapse#navbarNav.show {
            max-height: 85vh !important;
            opacity: 1 !important;
            transform: translateY(0) scale(1) !important;
            overflow-y: auto !important;
            -webkit-overflow-scrolling: touch !important;
            border-top: 1px solid var(--border-color, #e2e8f0) !important;
            margin-top: 0.5rem !important;
            padding-top: 0.4rem !important;
            padding-bottom: 0.8rem !important;
          }

          [data-bs-theme="dark"] #navbarNav.show,
          [data-bs-theme="dark"] .navbar-collapse#navbarNav.show {
            border-top-color: rgba(255, 255, 255, 0.08) !important;
          }
        }

        @media (min-width: 992px) {
          #navbarNav,
          .navbar-collapse#navbarNav {
            display: none !important;
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
        /* ── Electron Safe Area & Drag Region ── */
        .is-electron-navbar {
           -webkit-app-region: drag;
        }
        .is-electron-navbar .desktop-right-actions {
           margin-right: calc(138px + env(safe-area-inset-right, 0px)) !important;
        }
        .is-electron-navbar .mobile-header-actions {
           margin-right: calc(138px + env(safe-area-inset-right, 0px)) !important;
        }
        .is-electron-navbar a,
        .is-electron-navbar button,
        .is-electron-navbar .dropdown,
        .is-electron-navbar input,
        .is-electron-navbar .nav-link,
        .is-electron-navbar .user-profile-pill,
        .is-electron-navbar .navbar-toggler,
        .is-electron-navbar .desktop-right-actions,
        .is-electron-navbar .mobile-header-actions,
        .is-electron-navbar .nav-item {
           -webkit-app-region: no-drag;
        }

        /* ── Compact Electron Window: prevent nav overlap ── */
        @media (max-width: 1200px) {
          .is-electron-navbar .navbar-nav.position-absolute {
            position: relative !important;
            transform: none !important;
            left: auto !important;
            top: auto !important;
            flex: 1 1 auto;
            min-width: 0;
            justify-content: center;
            overflow: hidden;
            scrollbar-width: none;
            -ms-overflow-style: none;
            margin: 0 0.5rem;
          }
          .is-electron-navbar .navbar-nav.position-absolute::-webkit-scrollbar {
            display: none;
          }
          .is-electron-navbar .navbar-nav .nav-link {
            font-size: 0.75rem !important;
            padding: 0.4rem 0.65rem !important;
            white-space: nowrap;
          }
        }
        @media (max-width: 1000px) {
          .is-electron-navbar .navbar-nav .nav-link {
            font-size: 0.7rem !important;
            padding: 0.35rem 0.5rem !important;
            letter-spacing: 0.03em !important;
          }
          .is-electron-navbar .navbar-nav.position-absolute {
            gap: 2px !important;
          }
        }
        @media (max-width: 850px) {
          .is-electron-navbar .navbar-nav .nav-link {
            font-size: 0.65rem !important;
            padding: 0.3rem 0.4rem !important;
            letter-spacing: 0.02em !important;
          }
          .is-electron-navbar .navbar-nav.position-absolute {
            gap: 1px !important;
            margin: 0 0.25rem;
          }
          .is-electron-navbar .navbar-brand {
            font-size: 1.3rem !important;
          }
          .is-electron-navbar .desktop-right-actions {
            gap: 0.25rem !important;
          }
          .is-electron-navbar .theme-toggle-btn {
            width: 34px;
            height: 34px;
          }
          .is-electron-navbar .user-profile-pill {
            padding: 0.2rem 0.5rem 0.2rem 0.2rem;
          }
          .is-electron-navbar .user-name-text {
            font-size: 0.75rem;
          }
          .is-electron-navbar .user-avatar-circle {
            width: 28px;
            height: 28px;
            font-size: 0.7rem;
          }
        }
      `}</style>
      <nav className={`navbar navbar-expand-lg sticky-top ${navigator.userAgent.toLowerCase().includes('electron') || window.electronAPI?.isElectron ? 'is-electron-navbar' : ''}`}>
        <div className="container-fluid px-3 px-lg-4 position-relative d-flex align-items-center justify-content-between">
          {/* 1. Left: Brand Logo */}
          <a
            className="navbar-brand text-dynamic fw-bold m-0"
            href="#"
            style={{ fontSize: '1.75rem', letterSpacing: '-0.5px' }}
            onClick={(e) => { e.preventDefault(); setActivePage('home'); closeMobileNav(); }}
          >
            Smart <span style={{ color: '#2563eb' }}>Sight</span>
          </a>

          {/* 2. Center: Desktop Liquid Navigation Links (>= 992px) */}
          <ul
            ref={navContainerRef}
            className="navbar-nav position-absolute start-50 top-50 translate-middle d-none d-lg-flex align-items-center p-0 m-0"
            onMouseLeave={() => setHoveredPage(null)}
            style={{ gap: '6px', zIndex: 10 }}
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
                    style={{
                      whiteSpace: 'nowrap',
                      ...(item.id === 'notifications' && unreadCount > 0 ? { paddingRight: '16px' } : {})
                    }}
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

          {/* 3. Right: Desktop Actions (>= 992px) */}
          <div className="d-none d-lg-flex align-items-center gap-2 desktop-right-actions">
            <button
              type="button"
              className="theme-toggle-btn"
              onClick={() => setShowServerModal(true)}
              title="Configure Server IP / Backend URL"
              aria-label="Server IP Settings"
            >
              <i className="bi bi-hdd-network" style={{ color: '#2563eb' }}></i>
            </button>

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

            {isAuthenticated ? (
              <div className="dropdown position-relative">
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
                      <a className="dropdown-item d-flex align-items-center gap-3 py-2 px-3" style={{ color: 'var(--text-body)' }} href="#" onClick={(e) => { e.preventDefault(); setActivePage('admin'); closeMobileNav(); }}>
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
              </div>
            ) : (
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); setActivePage('login'); closeMobileNav(); }}
                className="btn mobile-login-btn rounded-pill px-4 py-2 fw-bold text-uppercase d-flex align-items-center gap-2 text-decoration-none shadow-sm transition-all"
                style={{ fontSize: '0.8rem', letterSpacing: '0.05em' }}
              >
                <i className="bi bi-box-arrow-in-right fs-6"></i>
                <span>Login</span>
              </button>
            )}
          </div>

          {/* 4. Mobile Header Actions (< 992px) */}
          <div className="d-flex align-items-center ms-auto d-lg-none mobile-header-actions">
            <button
              className={`navbar-toggler mobile-menu-btn ${isNavOpen ? 'is-active' : ''}`}
              type="button"
              onClick={() => setIsNavOpen(prev => !prev)}
              aria-expanded={isNavOpen}
              aria-label={isNavOpen ? "Close menu" : "Open menu"}
            >
              <i
                className={`bi ${isNavOpen ? 'bi-x-lg' : 'bi-list'}`}
                style={{
                  fontSize: isNavOpen ? '1.35rem' : '1.85rem',
                  color: '#2563eb',
                  lineHeight: 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'transform 0.32s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.22s ease',
                  transform: isNavOpen ? 'rotate(90deg) scale(1.05)' : 'rotate(0deg) scale(1)'
                }}
              ></i>
            </button>
          </div>

          {/* 5. Mobile Drawer (< 992px) */}
          <div className={`collapse navbar-collapse d-lg-none w-100 ${isNavOpen ? 'show' : ''}`} id="navbarNav">
            <div className="mobile-collapse-inner w-100">
              {/* Minimal Mobile Navigation Links */}
              <ul className="navbar-nav my-0.5 p-0">
                {[
                  { id: 'home', label: 'Home', icon: 'bi-house-door-fill' },
                  { id: 'detection', label: 'Detection', icon: 'bi-eye-fill' },
                  ...(isStaff ? [
                    { id: 'cameras', label: 'Cameras', icon: 'bi-camera-video-fill' },
                    { id: 'dataset', label: 'Dataset', icon: 'bi-database-fill-gear' },
                    { id: 'reports', label: 'Reports', icon: 'bi-bar-chart-fill' },
                    { id: 'notifications', label: 'Alerts', icon: 'bi-bell-fill' },
                    { id: 'admin', label: 'Admin Panel', icon: 'bi-speedometer2' }
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

              {/* Mobile Footer with Theme Toggle */}
              <div className="pt-2 mt-1 border-top border-secondary border-opacity-25">
                <div className="d-flex align-items-center justify-content-between mb-2 px-1">
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
                      className="btn mobile-login-btn rounded-pill d-inline-flex align-items-center justify-content-center shadow-sm"
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: '0.92rem',
                        fontWeight: '600',
                        letterSpacing: '0.02em',
                        height: '42px',
                        padding: '0 28px',
                        gap: '8px',
                        lineHeight: '1',
                        width: 'auto'
                      }}
                    >
                      <i className="bi bi-box-arrow-in-right" style={{ fontSize: '1.05rem' }}></i>
                      <span>Login</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Server IP Config Modal for Desktop */}
      <ServerConfigModal
        show={showServerModal}
        onClose={() => setShowServerModal(false)}
      />
    </>
  );
}
