import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import API from '../api/axios';
import getImageUrl from '../utils/imageUrl';

export default function NotificationsPage({ setActivePage, user }) {
  const isLoggedIn = !!user || !!localStorage.getItem('access_token');

  if (!isLoggedIn) {
    return (
      <div className="notifications-page position-relative overflow-hidden container py-4 py-md-5 flex-grow-1 d-flex flex-column justify-content-center align-items-center" style={{ minHeight: 'calc(100vh - 160px)' }}>
        <div className="page-hero-bg-wrapper" style={{ maskImage: 'none', WebkitMaskImage: 'none' }}>
          <div className="page-hero-bg"></div>
          <div className="page-hero-orb"></div>
        </div>
        <div className="row justify-content-center w-100 position-relative" style={{ zIndex: 1 }}>
          <div className="col-11 col-sm-10 col-md-8 col-lg-6 col-xl-5">
            <div className="glass-card p-4 p-md-5 text-center position-relative overflow-hidden shadow-lg border border-secondary border-opacity-25" style={{ borderRadius: '24px' }}>
              <div className="d-inline-flex align-items-center justify-content-center rounded-circle bg-primary bg-opacity-10 p-4 mb-4" style={{ width: '84px', height: '84px', border: '1px solid rgba(13, 110, 253, 0.2)' }}>
                <i className="bi bi-shield-lock-fill text-primary" style={{ fontSize: '2.4rem' }}></i>
              </div>
              <h3 className="fw-bold text-dynamic mb-2">Authentication Required</h3>
              <p className="text-secondary small mb-4 px-md-3" style={{ lineHeight: '1.6' }}>
                You must be logged in to access live intruder detection alerts, view notification audit feeds, and manage security actions.
              </p>
              <div className="d-flex justify-content-center">
                <button
                  type="button"
                  className="btn btn-primary btn-lg rounded-pill px-4 py-2-5 fw-bold shadow d-inline-flex align-items-center gap-2 transition-all"
                  style={{ background: '#2563eb', border: 'none' }}
                  onClick={() => setActivePage ? setActivePage('login') : (window.location.hash = '#login')}
                >
                  <i className="bi bi-box-arrow-in-right fs-5"></i>
                  <span>Log In to View Alerts</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [sourceFilter, setSourceFilter] = useState('ALL'); // 'ALL', 'APP', 'TELEGRAM'
  const [timeframeFilter, setTimeframeFilter] = useState('all'); // 'all', 'today', 'week', 'month'
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL', 'APPROVED', 'CANCELLED', 'PENDING'
  const [searchQuery, setSearchQuery] = useState('');

  // Dropdown Open States
  const [showTimeframeDropdown, setShowTimeframeDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);

  // Selected Image Modal, Clear All Modal & UI Toast State
  const [selectedImage, setSelectedImage] = useState(null);
  const [showClearAllModal, setShowClearAllModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteNotif, setDeleteNotif] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (text, type = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    fetchNotifications();
    window.addEventListener('refresh-notifications', fetchNotifications);
    return () => window.removeEventListener('refresh-notifications', fetchNotifications);
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await API.get('/notifications/');
      setNotifications(res.data.notifications || []);
    } catch (err) {
      console.error('Error fetching notification audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTestAlert = async () => {
    try {
      await API.get('/test_alert/');
      fetchNotifications();
      showToast('Test intruder alert triggered!', 'success');
    } catch (err) {
      console.error('Failed to trigger test alert:', err);
      showToast('Failed to trigger test alert.', 'danger');
    }
  };

  const promptDeleteNotif = (notif) => {
    setDeleteNotif(notif);
    setShowDeleteModal(true);
  };

  const handleDeleteNotification = async (id) => {
    try {
      await API.delete(`/notifications/${id}/action/`);
      setNotifications(prev => prev.filter(n => n.id !== id));
      setShowDeleteModal(false);
      setDeleteNotif(null);
      showToast('Alert deleted from audit log.', 'info');
    } catch (err) {
      console.error('Error deleting notification:', err);
      showToast('Error deleting notification alert.', 'danger');
    }
  };

  const handleNotificationAction = async (id, action) => {
    try {
      const res = await API.post(`/notifications/${id}/action/`, { action, source: 'APP' });
      if (res.data && (res.data.status === 'success' || res.data.notification_status)) {
        const newStatus = res.data.notification_status || (action === 'approve' ? 'APPROVED' : 'CANCELLED');
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, status: newStatus, action_source: 'APP' } : n));
        showToast(action === 'approve' ? 'Intruder alert approved from App!' : 'Intruder alert cancelled.', action === 'approve' ? 'success' : 'info');
      } else if (res.data && res.data.status === 'already_processed') {
        showToast(res.data.message || 'Alert was already processed.', 'info');
        fetchNotifications();
      }
    } catch (err) {
      console.error('Error processing notification action:', err);
      showToast('Failed to process alert action.', 'danger');
    }
  };

  const handleClearAllNotifications = async () => {
    try {
      await API.delete('/notifications/');
      setNotifications([]);
      setShowClearAllModal(false);
      showToast('All notification alerts cleared successfully!', 'success');
    } catch (err) {
      console.error('Error clearing all notifications:', err);
      showToast('Failed to clear notifications.', 'danger');
    }
  };

  // Filter Logic
  const filteredNotifications = notifications.filter((item) => {
    // 1. Source Filter (Radio Button)
    if (sourceFilter !== 'ALL' && item.action_source !== sourceFilter) {
      return false;
    }

    // 2. Status Filter
    if (statusFilter !== 'ALL' && item.status !== statusFilter) {
      return false;
    }

    // 3. Timeframe Filter
    if (timeframeFilter !== 'all' && item.created_at) {
      const itemDate = new Date(item.created_at);
      const now = new Date();
      if (timeframeFilter === 'today') {
        const isToday = itemDate.getDate() === now.getDate() &&
          itemDate.getMonth() === now.getMonth() &&
          itemDate.getFullYear() === now.getFullYear();
        if (!isToday) return false;
      } else if (timeframeFilter === 'week') {
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        if (itemDate < sevenDaysAgo) return false;
      } else if (timeframeFilter === 'month') {
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        if (itemDate < thirtyDaysAgo) return false;
      }
    }

    // 4. Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const titleMatch = item.title?.toLowerCase().includes(q);
      const msgMatch = item.message?.toLowerCase().includes(q);
      if (!titleMatch && !msgMatch) return false;
    }

    return true;
  });

  // Calculate Stat Counts
  const totalCount = notifications.length;
  const appApprovals = notifications.filter(n => n.action_source === 'APP' && n.status === 'APPROVED').length;
  const telegramApprovals = notifications.filter(n => n.action_source === 'TELEGRAM' && n.status === 'APPROVED').length;
  const totalCancelled = notifications.filter(n => n.status === 'CANCELLED').length;

  return (
    <div className="notifications-page min-vh-100">

      {/* Notifications Hero */}
      <section className="page-hero">
        <div className="page-hero-bg-wrapper">
          <div className="page-hero-bg"></div>
          <div className="page-hero-orb"></div>
        </div>

        <div className="container page-hero-content" style={{ zIndex: 2 }}>
          <div className="row align-items-center text-center text-md-start">
            <div className="col-md-8 mb-3 mb-md-0">
              <h1 className="notif-title mb-2">
                Notification <span className="accent">Alerts</span>
              </h1>
              <p className="page-hero-sub mx-auto ms-md-0 text-secondary mb-0">
                Track, inspect, and filter security detection alerts processed via Mobile App vs Telegram Bot.
              </p>
            </div>

            <div className="col-md-4 text-center text-md-end mt-3 mt-md-0">
              <button
                type="button"
                className="btn btn-glass-primary rounded-pill px-4 py-2 fw-bold d-inline-flex align-items-center justify-content-center gap-2"
                onClick={fetchNotifications}
                style={{
                  background: '#2563eb',
                  backgroundColor: '#2563eb',
                  backgroundImage: 'none',
                  color: '#ffffff',
                  border: 'none',
                  boxShadow: 'none',
                  opacity: 1
                }}
              >
                <i className="bi bi-arrow-clockwise fs-6" style={{ color: '#ffffff' }}></i>
                <span style={{ color: '#ffffff' }}>Refresh Feed</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="container">
        {/* Overview Stats Cards - Premium Counter Inside Round Design */}
        <div className="row g-3 mb-4">
          {/* Total Alerts Card */}
          <div className="col-12 col-sm-6 col-xl-3">
            <div className="stat-card-blue p-3 p-md-4 d-flex align-items-center justify-content-between h-100" style={{ borderRadius: '20px' }}>
              <div className="d-flex align-items-center gap-3 min-w-0">
                <div className="d-flex align-items-center justify-content-center rounded-3 flex-shrink-0" style={{ width: '36px', height: '36px', background: 'rgba(13, 110, 253, 0.1)' }}>
                  <i className="bi bi-bell-fill" style={{ color: '#2563eb', fontSize: '1rem' }}></i>
                </div>
                <div className="min-w-0">
                  <h6 className="mb-0 fw-bold text-dynamic text-truncate" style={{ fontSize: '0.95rem' }}>Total Alerts</h6>
                  <span className="text-secondary d-block text-truncate" style={{ fontSize: '0.68rem', fontWeight: '600', letterSpacing: '0.5px', textTransform: 'uppercase' }}>All Notifications</span>
                </div>
              </div>
              <div className="rounded-circle d-flex align-items-center justify-content-center text-white shadow font-mono ms-2 flex-shrink-0"
                style={{ width: '46px', height: '46px', fontSize: '1.2rem', fontWeight: '800', background: '#2563eb', border: '3px solid rgba(255,255,255,0.1)' }}>
                {totalCount}
              </div>
            </div>
          </div>

          {/* Mobile App Approved Card */}
          <div className="col-12 col-sm-6 col-xl-3">
            <div className="stat-card-green p-3 p-md-4 d-flex align-items-center justify-content-between h-100" style={{ borderRadius: '20px' }}>
              <div className="d-flex align-items-center gap-3 min-w-0">
                <div className="d-flex align-items-center justify-content-center rounded-3 flex-shrink-0" style={{ width: '36px', height: '36px', background: 'rgba(16, 185, 129, 0.1)' }}>
                  <i className="bi bi-phone-fill" style={{ color: '#10b981', fontSize: '1rem' }}></i>
                </div>
                <div className="min-w-0">
                  <h6 className="mb-0 fw-bold text-dynamic text-truncate" style={{ fontSize: '0.95rem' }}>Mobile App</h6>
                  <span className="text-secondary d-block text-truncate" style={{ fontSize: '0.68rem', fontWeight: '600', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Approved</span>
                </div>
              </div>
              <div className="rounded-circle d-flex align-items-center justify-content-center text-white shadow font-mono ms-2 flex-shrink-0"
                style={{ width: '46px', height: '46px', fontSize: '1.2rem', fontWeight: '800', background: 'linear-gradient(135deg, #10b981, #34d399)', border: '3px solid rgba(255,255,255,0.1)' }}>
                {appApprovals}
              </div>
            </div>
          </div>

          {/* Telegram Approved Card */}
          <div className="col-12 col-sm-6 col-xl-3">
            <div className="stat-card-cyan p-3 p-md-4 d-flex align-items-center justify-content-between h-100" style={{ borderRadius: '20px' }}>
              <div className="d-flex align-items-center gap-3 min-w-0">
                <div className="d-flex align-items-center justify-content-center rounded-3 flex-shrink-0" style={{ width: '36px', height: '36px', background: 'rgba(6, 182, 212, 0.1)' }}>
                  <i className="bi bi-telegram" style={{ color: '#06b6d4', fontSize: '1rem' }}></i>
                </div>
                <div className="min-w-0">
                  <h6 className="mb-0 fw-bold text-dynamic text-truncate" style={{ fontSize: '0.95rem' }}>Telegram</h6>
                  <span className="text-secondary d-block text-truncate" style={{ fontSize: '0.68rem', fontWeight: '600', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Approved</span>
                </div>
              </div>
              <div className="rounded-circle d-flex align-items-center justify-content-center text-white shadow font-mono ms-2 flex-shrink-0"
                style={{ width: '46px', height: '46px', fontSize: '1.2rem', fontWeight: '800', background: 'linear-gradient(135deg, #06b6d4, #22d3ee)', border: '3px solid rgba(255,255,255,0.1)' }}>
                {telegramApprovals}
              </div>
            </div>
          </div>

          {/* Rejected / Cancelled Card */}
          <div className="col-12 col-sm-6 col-xl-3">
            <div className="stat-card-red p-3 p-md-4 d-flex align-items-center justify-content-between h-100" style={{ borderRadius: '20px' }}>
              <div className="d-flex align-items-center gap-3 min-w-0">
                <div className="d-flex align-items-center justify-content-center rounded-3 flex-shrink-0" style={{ width: '36px', height: '36px', background: 'rgba(239, 68, 68, 0.1)' }}>
                  <i className="bi bi-x-circle-fill" style={{ color: '#ef4444', fontSize: '1rem' }}></i>
                </div>
                <div className="min-w-0">
                  <h6 className="mb-0 fw-bold text-dynamic text-truncate" style={{ fontSize: '0.95rem' }}>Cancelled</h6>
                  <span className="text-secondary d-block text-truncate" style={{ fontSize: '0.68rem', fontWeight: '600', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Rejected</span>
                </div>
              </div>
              <div className="rounded-circle d-flex align-items-center justify-content-center text-white shadow font-mono ms-2 flex-shrink-0"
                style={{ width: '46px', height: '46px', fontSize: '1.2rem', fontWeight: '800', background: 'linear-gradient(135deg, #ef4444, #f87171)', border: '3px solid rgba(255,255,255,0.1)' }}>
                {totalCancelled}
              </div>
            </div>
          </div>
        </div>

        {/* Filter Toolbar (Segment Radio Group + UI Custom Dropdowns + Search) */}
        <div className="glass-card p-3 p-md-4 mb-4" style={{ position: 'relative', zIndex: 10 }}>
          <div className="row g-3 align-items-center">

            {/* 1. Radio Button Segment Group for Action Source Filter */}
            <div className="col-12 col-lg-5">
              <label className="form-label text-secondary small fw-bold mb-2 d-block">Filter By Action Origin:</label>
              <div className="source-radio-group">
                <button
                  type="button"
                  className={`source-radio-btn ${sourceFilter === 'ALL' ? 'active' : ''}`}
                  onClick={() => setSourceFilter('ALL')}
                >
                  <i className="bi bi-grid-fill"></i>
                  <span>All<span className="d-none d-sm-inline"> Sources</span></span>
                </button>

                <button
                  type="button"
                  className={`source-radio-btn ${sourceFilter === 'APP' ? 'active' : ''}`}
                  onClick={() => setSourceFilter('APP')}
                >
                  <i className="bi bi-phone-fill"></i>
                  <span>Mobile<span className="d-none d-sm-inline"> App</span></span>
                </button>

                <button
                  type="button"
                  className={`source-radio-btn ${sourceFilter === 'TELEGRAM' ? 'active' : ''}`}
                  onClick={() => setSourceFilter('TELEGRAM')}
                >
                  <i className="bi bi-telegram"></i>
                  <span>Telegram<span className="d-none d-sm-inline"> Bot</span></span>
                </button>
              </div>
            </div>

            {/* 2. Custom UI Dropdowns (Timeframe & Status) */}
            <div className="col-12 col-md-6 col-lg-4">
              <div className="row g-2">

                {/* Timeframe Custom UI Dropdown */}
                <div className="col-6">
                  <label className="form-label text-secondary small fw-bold mb-1">Timeframe:</label>
                  <div className="dropdown position-relative">
                    <button
                      type="button"
                      className="btn w-100 d-flex align-items-center justify-content-between text-dynamic py-2 px-3 rounded-pill"
                      style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}
                      onClick={() => { setShowTimeframeDropdown(!showTimeframeDropdown); setShowStatusDropdown(false); }}
                    >
                      <span className="text-truncate d-flex align-items-center gap-2">
                        <i className="bi bi-calendar3 text-primary"></i>
                        {timeframeFilter === 'today' ? 'Today' : timeframeFilter === 'week' ? 'Last Week' : timeframeFilter === 'month' ? 'Last Month' : 'All Time'}
                      </span>
                      <i className={`bi bi-chevron-down ms-1 small transition-all ${showTimeframeDropdown ? 'rotate-180' : ''}`} style={{ fontSize: '0.7rem' }}></i>
                    </button>

                    {showTimeframeDropdown && (
                      <>
                        <div className="position-fixed inset-0" style={{ zIndex: 1050 }} onClick={() => setShowTimeframeDropdown(false)}></div>
                        <div className="custom-dropdown-menu">
                          {[
                            { label: 'All Time', value: 'all', icon: 'bi-calendar3' },
                            { label: 'Today', value: 'today', icon: 'bi-clock-history' },
                            { label: 'Last Week', value: 'week', icon: 'bi-calendar-week' },
                            { label: 'Last Month', value: 'month', icon: 'bi-calendar-month' }
                          ].map((opt) => (
                            <div
                              key={opt.value}
                              className={`custom-dropdown-item ${timeframeFilter === opt.value ? 'active' : ''}`}
                              onClick={() => { setTimeframeFilter(opt.value); setShowTimeframeDropdown(false); }}
                            >
                              <span className="d-flex align-items-center gap-2">
                                <i className={`bi ${opt.icon}`}></i> {opt.label}
                              </span>
                              {timeframeFilter === opt.value && <i className="bi bi-check2 text-primary"></i>}
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Status Custom UI Dropdown */}
                <div className="col-6">
                  <label className="form-label text-secondary small fw-bold mb-1">Status:</label>
                  <div className="dropdown position-relative">
                    <button
                      type="button"
                      className="btn w-100 d-flex align-items-center justify-content-between text-dynamic py-2 px-3 rounded-pill"
                      style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}
                      onClick={() => { setShowStatusDropdown(!showStatusDropdown); setShowTimeframeDropdown(false); }}
                    >
                      <span className="text-truncate d-flex align-items-center gap-2">
                        <i className="bi bi-funnel-fill text-primary"></i>
                        {statusFilter === 'APPROVED' ? 'Approved' : statusFilter === 'CANCELLED' ? 'Cancelled' : statusFilter === 'EXPIRED' ? 'Expired' : statusFilter === 'PENDING' ? 'Pending' : 'All Status'}
                      </span>
                      <i className={`bi bi-chevron-down ms-1 small transition-all ${showStatusDropdown ? 'rotate-180' : ''}`} style={{ fontSize: '0.7rem' }}></i>
                    </button>

                    {showStatusDropdown && (
                      <>
                        <div className="position-fixed inset-0" style={{ zIndex: 1050 }} onClick={() => setShowStatusDropdown(false)}></div>
                        <div className="custom-dropdown-menu">
                          {[
                            { label: 'All Status', value: 'ALL', icon: 'bi-grid-fill' },
                            { label: 'Approved', value: 'APPROVED', icon: 'bi-check-circle-fill' },
                            { label: 'Cancelled', value: 'CANCELLED', icon: 'bi-x-circle-fill' },
                            { label: 'Expired', value: 'EXPIRED', icon: 'bi-clock-history' },
                            { label: 'Pending', value: 'PENDING', icon: 'bi-hourglass-split' }
                          ].map((opt) => (
                            <div
                              key={opt.value}
                              className={`custom-dropdown-item ${statusFilter === opt.value ? 'active' : ''}`}
                              onClick={() => { setStatusFilter(opt.value); setShowStatusDropdown(false); }}
                            >
                              <span className="d-flex align-items-center gap-2">
                                <i className={`bi ${opt.icon}`}></i> {opt.label}
                              </span>
                              {statusFilter === opt.value && <i className="bi bi-check2 text-primary"></i>}
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>

              </div>
            </div>

            {/* 3. Search Input & Clear All */}
            <div className="col-12 col-md-6 col-lg-3 d-flex flex-column gap-1">
              <div className="d-flex align-items-center justify-content-between">
                <label className="form-label text-secondary small fw-bold mb-0">Search Alerts:</label>
                {notifications.length > 0 && (
                  <button
                    onClick={() => setShowClearAllModal(true)}
                    className="btn btn-link text-danger text-decoration-none p-0 x-small fw-bold d-flex align-items-center gap-1"
                    style={{ fontSize: '0.75rem' }}
                    title="Delete All Notifications"
                  >
                    <i className="bi bi-trash3-fill"></i> Clear All
                  </button>
                )}
              </div>
              <div className="position-relative">
                <i className="bi bi-search position-absolute top-50 start-0 translate-middle-y ms-3 text-secondary"></i>
                <input
                  type="text"
                  className="form-control text-dynamic border-secondary border-opacity-25 rounded-pill ps-5 py-2 small"
                  style={{ background: 'var(--bg-input)' }}
                  placeholder="Filter titles or messages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

          </div>
        </div>

        {/* Mobile View Notification Feed (< 768px) */}
        <div className="d-block d-md-none">
          {loading ? (
            <div className="glass-card p-5 text-center">
              <div className="spinner-border text-primary me-2" role="status"></div>
              <span className="text-secondary fw-semibold">Loading Alerts...</span>
            </div>
          ) : filteredNotifications.length > 0 ? (
            filteredNotifications.map((notif) => (
              <div key={notif.id} className="notif-item-card">
                <div className="d-flex align-items-start gap-3">
                  {/* Intruder Thumbnail */}
                  <div
                    className="notif-thumb-box"
                    onClick={() => notif.image_url && setSelectedImage(getImageUrl(notif.image_url))}
                    title={notif.image_url ? "Click to view full photo" : "No snapshot"}
                  >
                    {notif.image_url ? (
                      <img
                        src={getImageUrl(notif.image_url)}
                        alt="Intruder"
                      />
                    ) : (
                      <div className="w-100 h-100 d-flex align-items-center justify-content-center">
                        <i className="bi bi-person-bounding-box text-secondary opacity-50 fs-5"></i>
                      </div>
                    )}
                  </div>

                  {/* Notification Info */}
                  <div className="flex-grow-1 min-w-0">
                    <div className="d-flex align-items-center justify-content-between gap-2 mb-1.5 w-100">
                      <div className="d-flex align-items-center gap-2 min-w-0">
                        <div className="notif-bell-icon-badge">
                          <i className="bi bi-bell-fill"></i>
                        </div>
                        <span className="fw-bold text-dynamic" style={{ fontSize: '0.92rem', wordBreak: 'break-word' }}>
                          {notif.title}
                        </span>
                      </div>

                      <span className={`notif-status-badge status-${(notif.status || '').toLowerCase()}`}>
                        {notif.status}
                      </span>
                    </div>

                    <p className="text-secondary small mb-2" style={{ fontSize: '0.82rem', lineHeight: '1.45' }}>
                      {notif.message}
                    </p>

                    {/* Quick Approval / Dismiss for PENDING Alerts */}


                    <div className="d-flex align-items-center justify-content-between gap-2 pt-2 border-top border-white border-opacity-10 w-100">
                      <div className="d-flex align-items-center gap-2 min-w-0 flex-wrap">
                        {notif.action_source === 'APP' ? (
                          <span className="badge rounded-pill px-2.5 py-1 fw-bold d-inline-flex align-items-center gap-1" style={{ background: 'rgba(13, 110, 253, 0.12)', color: '#2563eb', border: '1px solid rgba(13, 110, 253, 0.3)', fontSize: '0.68rem' }}>
                            <i className="bi bi-phone-fill"></i> Web / Mobile
                          </span>
                        ) : notif.action_source === 'TELEGRAM' ? (
                          <span className="badge rounded-pill px-2.5 py-1 fw-bold d-inline-flex align-items-center gap-1" style={{ background: 'rgba(14, 165, 233, 0.12)', color: '#0284c7', border: '1px solid rgba(14, 165, 233, 0.3)', fontSize: '0.68rem' }}>
                            <i className="bi bi-telegram"></i> Telegram
                          </span>
                        ) : (
                          <span className="badge rounded-pill px-2.5 py-1 text-secondary border border-secondary border-opacity-25" style={{ background: 'var(--bg-input)', fontSize: '0.68rem' }}>
                            {notif.status === 'PENDING' ? 'Pending Action' : 'System Log'}
                          </span>
                        )}
                        <span className="text-muted small d-inline-flex align-items-center gap-1 font-mono" style={{ fontSize: '0.72rem' }}>
                          <i className="bi bi-clock"></i>
                          {notif.created_at ? new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>

                      <button
                        onClick={() => promptDeleteNotif(notif)}
                        className="btn btn-sm text-danger border-0 p-1.5 rounded-circle hover-scale flex-shrink-0"
                        style={{ background: 'rgba(220, 53, 69, 0.1)' }}
                        title="Delete Alert"
                      >
                        <i className="bi bi-trash3-fill" style={{ fontSize: '0.85rem' }}></i>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="glass-card p-5 text-center text-secondary">
              <i className="bi bi-inbox fs-1 d-block mb-2 text-muted"></i>
              No notifications found matching your filter settings.
            </div>
          )}
        </div>

        {/* Desktop View Table (>= 768px) */}
        <div className="glass-card overflow-hidden d-none d-md-block">
          <div className="table-responsive">
            <table className="table custom-table notif-table table-hover align-middle mb-0" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th scope="col" style={{ width: '65px' }} className="text-center">Image</th>
                  <th scope="col" style={{ width: '24%' }}>Alert Title</th>
                  <th scope="col" style={{ width: '28%' }}>Message Detail</th>
                  <th scope="col" style={{ width: '12%' }} className="text-center">Status</th>
                  <th scope="col" style={{ width: '15%' }} className="text-center">Action Source</th>
                  <th scope="col" style={{ width: '13%' }} className="text-center">Timestamp</th>
                  <th scope="col" style={{ width: '80px' }} className="text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" className="text-center py-5">
                      <div className="spinner-border text-primary me-2" role="status"></div>
                      <span className="text-secondary fw-semibold">Loading Notification Audit Logs...</span>
                    </td>
                  </tr>
                ) : filteredNotifications.length > 0 ? (
                  filteredNotifications.map((notif) => (
                    <tr key={notif.id}>
                      {/* Intruder Image Thumbnail */}
                      <td className="text-center">
                        <div
                          className="notif-thumb-box mx-auto"
                          style={{ width: '48px', height: '48px', borderRadius: '12px' }}
                          onClick={() => notif.image_url && setSelectedImage(getImageUrl(notif.image_url))}
                          title={notif.image_url ? "Click to view full photo" : "No snapshot"}
                        >
                          {notif.image_url ? (
                            <img
                              src={getImageUrl(notif.image_url)}
                              alt="Intruder"
                            />
                          ) : (
                            <div className="w-100 h-100 d-flex align-items-center justify-content-center">
                              <i className="bi bi-person-bounding-box text-secondary opacity-50 fs-6"></i>
                            </div>
                          )}
                        </div>
                      </td>

                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <div className="notif-bell-icon-badge" style={{ width: '26px', height: '26px', fontSize: '0.85rem' }}>
                            <i className="bi bi-bell-fill"></i>
                          </div>
                          <span className="fw-bold text-dynamic" style={{ fontSize: '0.9rem', wordBreak: 'break-word' }}>
                            {notif.title}
                          </span>
                        </div>
                      </td>

                      <td className="text-secondary small" style={{ whiteSpace: 'normal', wordBreak: 'break-word', fontSize: '0.82rem', lineHeight: '1.4' }}>
                        {notif.message}
                      </td>

                      {/* Status Badge */}
                      <td className="text-center">
                        <span className={`notif-status-badge status-${(notif.status || '').toLowerCase()}`}>
                          {notif.status}
                        </span>
                      </td>

                      {/* Action Source Badge */}
                      <td className="text-center">
                        {notif.action_source === 'APP' ? (
                          <span className="badge rounded-pill px-2.5 py-1.5 fw-bold d-inline-flex align-items-center gap-1" style={{ background: 'rgba(13, 110, 253, 0.12)', color: '#2563eb', border: '1px solid rgba(13, 110, 253, 0.3)', fontSize: '0.72rem' }}>
                            <i className="bi bi-phone-fill"></i> Web / Mobile
                          </span>
                        ) : notif.action_source === 'TELEGRAM' ? (
                          <span className="badge rounded-pill px-2.5 py-1.5 fw-bold d-inline-flex align-items-center gap-1" style={{ background: 'rgba(14, 165, 233, 0.12)', color: '#0284c7', border: '1px solid rgba(14, 165, 233, 0.3)', fontSize: '0.72rem' }}>
                            <i className="bi bi-telegram"></i> Telegram
                          </span>
                        ) : (
                          <span className="badge rounded-pill px-2.5 py-1.5 text-secondary border border-secondary border-opacity-25" style={{ background: 'var(--bg-input)', fontSize: '0.72rem' }}>
                            {notif.status === 'PENDING' ? 'Pending' : 'Processed'}
                          </span>
                        )}
                      </td>

                      <td className="text-center text-secondary small font-mono" style={{ whiteSpace: 'nowrap', lineHeight: '1.2' }}>
                        <div>{notif.created_at ? new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'N/A'}</div>
                        <div className="x-small text-muted" style={{ fontSize: '0.7rem' }}>{notif.created_at ? new Date(notif.created_at).toLocaleDateString() : ''}</div>
                      </td>

                      {/* Action Controls */}
                      <td className="text-center">
                        <div className="d-flex align-items-center justify-content-center gap-1.5">

                          <button
                            onClick={() => promptDeleteNotif(notif)}
                            className="btn btn-sm text-danger border-0 p-1.5 rounded-circle hover-scale"
                            style={{ background: 'rgba(220, 53, 69, 0.1)' }}
                            title="Delete Alert"
                          >
                            <i className="bi bi-trash3-fill" style={{ fontSize: '0.88rem' }}></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="text-center py-5 text-secondary">
                      <i className="bi bi-inbox fs-2 d-block mb-2 text-muted"></i>
                      No notification logs match your current filter settings.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Image Zoom Modal - Mounted directly on document.body via React Portal */}
      {selectedImage && createPortal(
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-flex flex-column align-items-center justify-content-center p-3 p-md-4"
          style={{
            zIndex: 99999,
            backgroundColor: 'rgba(0, 0, 0, 0.95)',
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            height: '100vh'
          }}
          onClick={() => setSelectedImage(null)}
        >
          {/* Top Floating Control Bar */}
          <div className="position-absolute top-0 start-0 end-0 d-flex align-items-center justify-content-between p-3 px-md-4" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.85), transparent)', zIndex: 100000 }} onClick={e => e.stopPropagation()}>
            <div className="d-flex align-items-center gap-2 text-white">
              <i className="bi bi-person-bounding-box text-primary fs-5"></i>
              <span className="fw-bold small">Intruder Image Preview</span>
            </div>
            <button
              type="button"
              className="btn btn-dark rounded-circle d-flex align-items-center justify-content-center p-0 border border-white border-opacity-25 text-white shadow-lg"
              style={{ width: '42px', height: '42px', background: 'rgba(255,255,255,0.2)' }}
              onClick={() => setSelectedImage(null)}
              title="Close Preview"
            >
              <i className="bi bi-x-lg fs-6"></i>
            </button>
          </div>

          {/* Full Intruder Image Container */}
          <div className="d-flex align-items-center justify-content-center w-100 h-100 my-auto" onClick={e => e.stopPropagation()}>
            <img
              src={selectedImage}
              alt="Full Intruder Preview"
              className="img-fluid rounded-4 shadow-2xl border border-white border-opacity-20"
              style={{ maxHeight: '82vh', maxWidth: '95vw', objectFit: 'contain' }}
            />
          </div>
        </div>,
        document.body
      )}

      {/* Single Delete Confirmation Modal - Mounted directly on document.body via React Portal */}
      {showDeleteModal && deleteNotif && createPortal(
        <>
          <div className="modal-backdrop fade show modern-backdrop" style={{ opacity: 0.75, zIndex: 10540 }} onClick={() => setShowDeleteModal(false)}></div>
          <div
            className="modal fade show"
            tabIndex="-1"
            aria-hidden="true"
            onClick={() => setShowDeleteModal(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: '100vw',
              height: '100vh',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10550,
              padding: '1rem'
            }}
          >
            <div
              className="modal-content overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: '340px',
                background: 'var(--modal-bg)',
                border: '1px solid var(--modal-border)',
                borderRadius: '28px',
              }}
            >
              <div className="modal-body p-4 text-center d-flex flex-column align-items-center justify-content-center">
                <div className="bg-danger bg-opacity-10 rounded-circle d-inline-flex align-items-center justify-content-center mb-3"
                  style={{ width: '64px', height: '64px', border: '1px solid rgba(220, 53, 69, 0.2)' }}>
                  <i className="bi bi-exclamation-triangle-fill text-danger fs-2"></i>
                </div>
                <h5 className="fw-bold mb-2 text-center" style={{ color: 'var(--text-heading)' }}>Delete Alert?</h5>
                <p className="small mb-4 lh-base text-center" style={{ color: 'var(--text-secondary)' }}>
                  Are you sure you want to remove <strong style={{ color: 'var(--text-heading)' }}>{deleteNotif.title}</strong> from log history?
                </p>
                <form className="w-100" onSubmit={(e) => { e.preventDefault(); if (deleteNotif) handleDeleteNotification(deleteNotif.id); }}>
                  <div className="d-flex gap-2 w-100">
                    <button type="button" className="btn btn-outline-secondary w-100 rounded-pill py-2 small fw-bold" style={{ color: 'var(--text-heading)', borderColor: 'var(--border-color)' }} onClick={() => setShowDeleteModal(false)}>Decline</button>
                    <button type="submit" className="btn btn-danger w-100 rounded-pill py-2 small fw-bold shadow-danger">Confirm</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}

      {/* Clear All Confirmation Modal - Mounted directly on document.body via React Portal */}
      {showClearAllModal && createPortal(
        <>
          <div className="modal-backdrop fade show modern-backdrop" style={{ opacity: 0.75, zIndex: 10540 }} onClick={() => setShowClearAllModal(false)}></div>
          <div
            className="modal fade show"
            tabIndex="-1"
            aria-hidden="true"
            onClick={() => setShowClearAllModal(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: '100vw',
              height: '100vh',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10550,
              padding: '1rem'
            }}
          >
            <div
              className="modal-content overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: '340px',
                background: 'var(--modal-bg)',
                border: '1px solid var(--modal-border)',
                borderRadius: '28px',
              }}
            >
              <div className="modal-body p-4 text-center d-flex flex-column align-items-center justify-content-center">
                <div className="bg-danger bg-opacity-10 rounded-circle d-inline-flex align-items-center justify-content-center mb-3"
                  style={{ width: '64px', height: '64px', border: '1px solid rgba(220, 53, 69, 0.2)' }}>
                  <i className="bi bi-exclamation-triangle-fill text-danger fs-2"></i>
                </div>
                <h5 className="fw-bold mb-2 text-center" style={{ color: 'var(--text-heading)' }}>Clear All Alerts?</h5>
                <p className="small mb-4 lh-base text-center" style={{ color: 'var(--text-secondary)' }}>
                  Are you sure you want to remove all notification alerts? This will permanently delete all intruder log records.
                </p>
                <form className="w-100" onSubmit={(e) => { e.preventDefault(); handleClearAllNotifications(); }}>
                  <div className="d-flex gap-2 w-100">
                    <button type="button" className="btn btn-outline-secondary w-100 rounded-pill py-2 small fw-bold" style={{ color: 'var(--text-heading)', borderColor: 'var(--border-color)' }} onClick={() => setShowClearAllModal(false)}>Decline</button>
                    <button type="submit" className="btn btn-danger w-100 rounded-pill py-2 small fw-bold shadow-danger">Confirm</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}

      {/* Floating UI Toast Notification Banner */}
      {toastMessage && (
        <div className="position-fixed top-0 end-0 p-3 pt-4 me-2 me-md-3" style={{ zIndex: 10600 }}>
          <div
            className={`glass-card p-3 px-4 rounded-pill shadow-2xl d-flex align-items-center gap-2.5 border ${toastMessage.type === 'success' ? 'border-success text-success' : toastMessage.type === 'info' ? 'border-info text-info' : 'border-danger text-danger'
              }`}
            style={{ background: 'var(--bg-surface-solid)', boxShadow: '0 12px 35px rgba(0,0,0,0.3)' }}
          >
            <i className={`bi ${toastMessage.type === 'success' ? 'bi-check-circle-fill fs-5' : toastMessage.type === 'info' ? 'bi-info-circle-fill fs-5' : 'bi-exclamation-octagon-fill fs-5'}`}></i>
            <span className="fw-bold small text-dynamic">{toastMessage.text}</span>
          </div>
        </div>
      )}
    </div>
  );
}
