import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import API from '../api/axios';
import getImageUrl from '../utils/imageUrl';

export default function ReportsPage() {
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportScope, setExportScope] = useState('all'); // 'all', 'known', 'unknown'
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [totalDetections, setTotalDetections] = useState(0);
  const [knownDetections, setKnownDetections] = useState(0);
  const [unknownDetections, setUnknownDetections] = useState(0);

  const [frequentPersons, setFrequentPersons] = useState([]);
  const [reports, setReports] = useState([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [cameraQuery, setCameraQuery] = useState('all');
  const [statusQuery, setStatusQuery] = useState('all');
  const [timeframeQuery, setTimeframeQuery] = useState('all');

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [showPerPageDropdown, setShowPerPageDropdown] = useState(false);
  const [showCameraDropdown, setShowCameraDropdown] = useState(false);
  const [showPersonDropdown, setShowPersonDropdown] = useState(false);
  const [showTimeframeDropdown, setShowTimeframeDropdown] = useState(false);

  const [exportRange, setExportRange] = useState('daily');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [activeChart, setActiveChart] = useState('bar');
  const [chartTimeframe, setChartTimeframe] = useState('7D');
  const [chartScope, setChartScope] = useState('ALL');
  const [timelineFilter, setTimelineFilter] = useState('ALL'); // 'ALL', 'UNKNOWN', 'KNOWN'
  const [hoveredScrubberEvent, setHoveredScrubberEvent] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const barChartRef = useRef(null);
  const doughnutChartRef = useRef(null);
  const exportBtnRef = useRef(null);
  const timelineScrollRef = useRef(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 });
  const [toastMessage, setToastMessage] = useState(null);

  useEffect(() => {
    if (timelineScrollRef.current) {
      const scrollContainer = timelineScrollRef.current;
      const now = new Date();
      const nowMins = now.getHours() * 60 + now.getMinutes();
      const nowPct = nowMins / 1440;
      const targetScroll = (650 * nowPct) - (scrollContainer.clientWidth / 2);
      scrollContainer.scrollLeft = Math.max(0, targetScroll);
    }
  }, []);

  const showToast = (text, type = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  const openExportDropdown = () => {
    setShowExportDropdown(!showExportDropdown);
  };

  // ── Download Excel Report from Django OpenPyXL Backend ──
  const handleBackendExport = async (params = {}) => {
    try {
      setShowExportDropdown(false);
      setShowExportModal(false);

      const response = await API.get('/reports/export/', {
        params,
        responseType: 'blob',
      });

      let filename = `SmartSight_${params.time_range || 'Export'}_Report.xlsx`;
      const contentDisposition = response.headers && response.headers['content-disposition'];
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) filename = match[1];
      }

      // Desktop Browser / Electron Download
      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      if (window.showToast) {
        window.showToast('Report downloaded successfully.', 'success', 'SUCCESS');
      } else if (showToast) {
        showToast('Report downloaded successfully.', 'success');
      }
    } catch (err) {
      console.error('Error downloading Excel report:', err);
      if (window.showToast) {
        window.showToast('Could not download report file. Please verify server connection.', 'error', 'SYSTEM ALERT');
      } else if (showToast) {
        showToast('Could not download report file. Please verify server connection.', 'error');
      }
    }
  };

  const handleQuickExport = (range) => {
    handleBackendExport({ time_range: range });
  };

  const handleExportDownload = (e) => {
    e.preventDefault();
    const params = { time_range: exportRange, status_scope: exportScope };
    if (startDate && endDate) {
      params.start_date = startDate;
      params.end_date = endDate;
      params.time_range = 'custom';
    }
    handleBackendExport(params);
  };

  const fetchReports = async () => {
    try {
      const response = await API.get('/logs/');
      const logs = response.data;

      setTotalDetections(logs.length);
      const knownCount = logs.filter(l => l.status === 'KNOWN').length;
      setKnownDetections(knownCount);
      setUnknownDetections(logs.length - knownCount);

      // Map logs to individual detection records sorted by timestamp descending
      const mappedReports = logs.map(log => {
        const dateObj = new Date(log.timestamp);
        const day = String(dateObj.getDate()).padStart(2, '0');
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const year = dateObj.getFullYear();
        const dateStr = `${day}/${month}/${year}`;
        const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        return {
          id: log.id,
          date: dateStr,
          rawTimestamp: dateObj.getTime(),
          camera_name: log.camera_name || "Default Camera",
          person_name: log.person_name || "Unknown Person",
          name: log.person_name || "Unknown Person",
          status: log.status,
          entry_time: timeStr,
          exit_time: timeStr,
          frequency: 1,
          image_path: log.image_path,
          imageUrl: log.image_path ? getImageUrl(log.image_path) : null,
          confidence: log.confidence
        };
      }).sort((a, b) => b.rawTimestamp - a.rawTimestamp);

      setReports(mappedReports);

      const personCounts = {};
      logs.forEach(log => {
        const name = log.person_name || 'Unknown Person';
        if (!personCounts[name]) {
          personCounts[name] = { count: 0, last_seen: log.timestamp, status: log.status };
        }
        personCounts[name].count += 1;
        if (new Date(log.timestamp) > new Date(personCounts[name].last_seen)) {
          personCounts[name].last_seen = log.timestamp;
        }
      });

      const frequent = Object.entries(personCounts).map(([name, data]) => {
        const dateObj = new Date(data.last_seen);
        const day = String(dateObj.getDate()).padStart(2, '0');
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const year = dateObj.getFullYear();
        const dateStr = `${day}/${month}/${year}`;
        const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        return {
          name,
          status: data.status,
          total_count: data.count,
          weekly_count: data.count,
          monthly_count: data.count,
          last_seen: `${dateStr}, ${timeStr}`
        };
      }).sort((a, b) => b.total_count - a.total_count);

      setFrequentPersons(frequent);
    } catch (error) {
      console.error("Failed to fetch reports", error);
    }
  };

  useEffect(() => {
    fetchReports();

    const revealElements = document.querySelectorAll("[data-reveal]");
    const revealOnScroll = function () {
      const windowHeight = window.innerHeight;
      revealElements.forEach(el => {
        const elementTop = el.getBoundingClientRect().top;
        const revealPoint = 150;
        if (elementTop < windowHeight - revealPoint) {
          el.classList.add("is-visible");
        }
      });
    };

    window.addEventListener("scroll", revealOnScroll);
    revealOnScroll();
    return () => window.removeEventListener("scroll", revealOnScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('#exportDropdownContainer')) {
        setShowExportDropdown(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [cameraQuery, statusQuery, timeframeQuery]);

  const availableCameras = useMemo(() => {
    const cams = new Set(reports.map(r => r.camera_name || "Default Camera"));
    return ['all', ...Array.from(cams)];
  }, [reports]);

  const availableYears = useMemo(() => {
    const currentYr = new Date().getFullYear();
    const years = new Set(
      reports
        .map(r => new Date(r.rawTimestamp).getFullYear())
        .filter(y => !isNaN(y) && y !== currentYr)
    );
    return Array.from(years).sort((a, b) => b - a);
  }, [reports]);

  const filteredReports = reports.filter(rep => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = (rep.person_name || '').toLowerCase().includes(q);
      const matchCam = (rep.camera_name || '').toLowerCase().includes(q);
      const matchDate = (rep.date || '').toLowerCase().includes(q);
      if (!matchName && !matchCam && !matchDate) return false;
    }

    if (cameraQuery && cameraQuery !== 'all') {
      if ((rep.camera_name || 'Default Camera').toLowerCase() !== cameraQuery.toLowerCase()) {
        return false;
      }
    }

    if (statusQuery && statusQuery !== 'all') {
      if (rep.status !== statusQuery) return false;
    }

    if (timeframeQuery && timeframeQuery !== 'all' && rep.rawTimestamp) {
      const now = new Date();
      const logDate = new Date(rep.rawTimestamp);

      if (timeframeQuery === 'today') {
        const isToday = logDate.getDate() === now.getDate() &&
          logDate.getMonth() === now.getMonth() &&
          logDate.getFullYear() === now.getFullYear();
        if (!isToday) return false;
      } else if (timeframeQuery === 'week') {
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        if (logDate < sevenDaysAgo) return false;
      } else if (timeframeQuery === 'month') {
        const isThisMonth = logDate.getMonth() === now.getMonth() &&
          logDate.getFullYear() === now.getFullYear();
        if (!isThisMonth) return false;
      } else if (timeframeQuery === 'year') {
        const isThisYear = logDate.getFullYear() === now.getFullYear();
        if (!isThisYear) return false;
      } else if (timeframeQuery.startsWith('year-')) {
        const targetYear = parseInt(timeframeQuery.replace('year-', ''), 10);
        if (logDate.getFullYear() !== targetYear) return false;
      }
    }
    return true;
  });

  const totalItems = filteredReports.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const currentReports = filteredReports.slice(startIndex, endIndex);

  const dailyCounts = useMemo(() => {
    const map = {};
    reports.forEach(r => {
      if (!map[r.date]) {
        map[r.date] = { date: r.date, known: 0, unknown: 0, total: 0, rawTimestamp: r.rawTimestamp || 0 };
      }
      if (r.status === 'KNOWN') {
        map[r.date].known += r.frequency || 1;
      } else {
        map[r.date].unknown += r.frequency || 1;
      }
      map[r.date].total += r.frequency || 1;
    });
    const sorted = Object.values(map).sort((a, b) => a.rawTimestamp - b.rawTimestamp);
    if (chartTimeframe === '7D') return sorted.slice(-7);
    if (chartTimeframe === '10D') return sorted.slice(-10);
    if (chartTimeframe === '14D') return sorted.slice(-14);
    if (chartTimeframe === '30D') return sorted.slice(-30);
    return sorted;
  }, [reports, chartTimeframe]);

  const totalDetectionsCount = reports.length;
  const knownCount = useMemo(() => reports.filter(r => r.status === 'KNOWN').length, [reports]);
  const unknownCount = useMemo(() => reports.filter(r => r.status === 'UNKNOWN').length, [reports]);
  const knownPct = totalDetectionsCount > 0 ? Math.round((knownCount / totalDetectionsCount) * 100) : 0;
  const unknownPct = totalDetectionsCount > 0 ? (100 - knownPct) : 0;

  return (
    <>

      {/* Reports Hero */}
      <section className="page-hero" style={{ position: 'relative', zIndex: 1050, overflow: 'visible' }}>
        <div className="page-hero-bg-wrapper">
          <div className="page-hero-bg"></div>
          <div className="page-hero-orb reports-orb"></div>
        </div>

        <div className="container page-hero-content" style={{ position: 'relative', zIndex: 1050 }}>
          <div className="row align-items-center">
            <div className="col-md-8 mb-3 mb-md-0 text-center text-md-start">
              <h1 className="reports-title mb-2">
                Recognition <span className="accent">Reports</span>
              </h1>
              <p className="page-hero-sub text-center text-md-start mb-0">
                Dynamic frequent persons dashboard &amp; surveillance analytics.
              </p>
            </div>
            <div className="col-md-4 text-center text-md-end">
              <div className="d-inline-block position-relative" id="exportDropdownContainer" style={{ zIndex: 1051 }}>
                <button
                  ref={exportBtnRef}
                  className="btn btn-excel px-4 py-2 rounded-pill d-inline-flex align-items-center justify-content-center gap-2"
                  type="button"
                  id="exportDropdown"
                  onClick={openExportDropdown}
                  aria-expanded={showExportDropdown}
                >
                  <i className="bi bi-file-earmark-excel-fill fs-5" style={{ color: '#ffffff' }}></i>
                  <span style={{ color: '#ffffff', fontWeight: 700 }}>Export Reports</span>
                  <i className={`bi bi-chevron-down ms-1 ${showExportDropdown ? 'rotate-180' : ''}`} style={{ fontSize: '0.8rem', transition: 'transform 0.25s ease', color: '#ffffff' }}></i>
                </button>

                {showExportDropdown && (
                  <ul
                    className="glass-dropdown-menu export-dropdown-menu shadow-lg text-start"
                    aria-labelledby="exportDropdown">
                    <li>
                      <a className="dropdown-item export-item-daily py-2 px-3 rounded-3" href="#" onClick={(e) => { e.preventDefault(); handleQuickExport('daily'); }}>
                        <i className="bi bi-calendar-day me-2 text-success"></i> Daily Report
                      </a>
                    </li>
                    <li>
                      <a className="dropdown-item export-item-weekly py-2 px-3 rounded-3" href="#" onClick={(e) => { e.preventDefault(); handleQuickExport('weekly'); }}>
                        <i className="bi bi-calendar-week me-2 text-primary"></i> Weekly Report
                      </a>
                    </li>
                    <li>
                      <a className="dropdown-item export-item-monthly py-2 px-3 rounded-3" href="#" onClick={(e) => { e.preventDefault(); handleQuickExport('monthly'); }}>
                        <i className="bi bi-calendar-month me-2 text-warning"></i> Monthly Report
                      </a>
                    </li>
                    <li>
                      <a className="dropdown-item export-item-yearly py-2 px-3 rounded-3" href="#" onClick={(e) => { e.preventDefault(); handleQuickExport('yearly'); }}>
                        <i className="bi bi-calendar-event me-2 text-danger"></i> Yearly Report
                      </a>
                    </li>
                    <li>
                      <a className="dropdown-item export-item-all py-2 px-3 rounded-3" href="#" onClick={(e) => { e.preventDefault(); handleQuickExport('all'); }}>
                        <i className="bi bi-archive me-2 text-info"></i> All Records
                      </a>
                    </li>
                    <li><hr className="dropdown-divider opacity-25 my-1" style={{ borderColor: 'var(--border-color)' }} /></li>
                    <li>
                      <a className="dropdown-item export-item-custom py-2 px-3 rounded-3 fw-bold" href="#" onClick={(e) => { e.preventDefault(); setShowExportDropdown(false); setShowExportModal(true); }}>
                        <i className="bi bi-sliders me-2 text-warning"></i> Custom
                      </a>
                    </li>
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="container py-4">
        {/* ── 24-HOUR INTERACTIVE SECURITY TIMELINE SCRUBBER ── */}
        {(() => {
          const todayReports = reports.filter(r => r.rawTimestamp && (new Date(r.rawTimestamp).toDateString() === new Date().toDateString()));
          const todayIntruderCount = todayReports.filter(r => r.status === 'UNKNOWN').length;
          const todayKnownCount = todayReports.filter(r => r.status === 'KNOWN').length;
          const now = new Date();
          const nowMins = now.getHours() * 60 + now.getMinutes();
          const nowPosPct = Math.min(99, Math.max(1, (nowMins / 1440) * 100));
          const nowTimeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          const visibleReports = todayReports.filter(r => {
            if (timelineFilter === 'UNKNOWN') return r.status === 'UNKNOWN';
            if (timelineFilter === 'KNOWN') return r.status === 'KNOWN';
            return true;
          });

          // Sort ascending for proximity staggering calculation
          const sortedList = [...visibleReports].sort((a, b) => a.rawTimestamp - b.rawTimestamp);
          const staggeredReports = sortedList.map((rep, i) => {
            const d = new Date(rep.rawTimestamp);
            const mins = d.getHours() * 60 + d.getMinutes();
            const posPct = Math.min(98.5, Math.max(1.5, (mins / 1440) * 100));
            let offsetIdx = 0;
            for (let j = Math.max(0, i - 3); j < i; j++) {
              const prevD = new Date(sortedList[j].rawTimestamp);
              const prevMins = prevD.getHours() * 60 + prevD.getMinutes();
              const prevPos = (prevMins / 1440) * 100;
              if (Math.abs(posPct - prevPos) < 2.5) {
                offsetIdx = (offsetIdx + 1) % 3;
              }
            }
            return { ...rep, posPct, offsetIdx, dateObj: d };
          });

          return (
            <div className="card glass-card border-0 p-4 mb-4 rounded-4 shadow-sm position-relative" style={{ background: 'var(--bg-surface-solid)' }}>
              <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-3">
                <div className="d-flex align-items-center gap-3">
                  <div
                    className="rounded-3 d-flex align-items-center justify-content-center text-primary flex-shrink-0 shadow-sm"
                    style={{
                      width: '40px',
                      height: '40px',
                      background: 'linear-gradient(135deg, rgba(13, 110, 253, 0.12) 0%, rgba(13, 202, 240, 0.12) 100%)',
                      border: '1px solid rgba(13, 110, 253, 0.25)',
                      color: '#2563eb'
                    }}
                  >
                    <i className="bi bi-clock-fill" style={{ fontSize: '1.2rem', lineHeight: 1 }}></i>
                  </div>
                  <div>
                    <h6 className="fw-bold text-dynamic mb-0 d-flex align-items-center gap-2" style={{ fontSize: '1rem', letterSpacing: '-0.2px' }}>
                      <span>24-Hour Security Timeline Scrubber</span>
                      <span className="badge rounded-pill bg-primary bg-opacity-10 text-primary fw-bold" style={{ fontSize: '0.68rem', border: '1px solid rgba(13, 110, 253, 0.2)' }}>
                        Today ({todayReports.length})
                      </span>
                    </h6>
                    <span className="text-secondary small" style={{ fontSize: '0.75rem' }}>
                      Interactive telemetry timeline for today's detections (00:00 - 23:59)
                    </span>
                  </div>
                </div>

                {/* Filter & Legend Badges with Fixed Gapping */}
                <div className="d-flex align-items-center gap-2 flex-wrap font-mono">
                  <button
                    type="button"
                    className={`btn btn-sm rounded-pill px-3 py-1.5 fw-bold d-inline-flex align-items-center gap-2 transition-all ${timelineFilter === 'ALL' ? 'shadow-sm' : 'border-0'
                      }`}
                    style={{
                      background: timelineFilter === 'ALL' ? '#2563eb' : 'rgba(13, 110, 253, 0.08)',
                      color: timelineFilter === 'ALL' ? '#ffffff' : '#2563eb',
                      border: '1px solid rgba(13, 110, 253, 0.25)',
                      fontSize: '0.78rem'
                    }}
                    onClick={() => setTimelineFilter('ALL')}
                    title="Show all detections"
                  >
                    <span>All ({todayReports.length})</span>
                  </button>

                  <button
                    type="button"
                    className={`btn btn-sm rounded-pill px-3 py-1.5 fw-bold d-inline-flex align-items-center gap-2 transition-all ${timelineFilter === 'UNKNOWN' ? 'shadow-sm' : 'border-0'
                      }`}
                    style={{
                      background: timelineFilter === 'UNKNOWN' ? '#dc3545' : 'rgba(220, 53, 69, 0.08)',
                      color: timelineFilter === 'UNKNOWN' ? '#ffffff' : '#dc3545',
                      border: '1px solid rgba(220, 53, 69, 0.25)',
                      fontSize: '0.78rem'
                    }}
                    onClick={() => setTimelineFilter(timelineFilter === 'UNKNOWN' ? 'ALL' : 'UNKNOWN')}
                    title="Click to filter Intruders"
                  >
                    <span className="rounded-circle d-inline-block" style={{ width: '8px', height: '8px', background: timelineFilter === 'UNKNOWN' ? '#ffffff' : '#dc3545', boxShadow: '0 0 6px rgba(220, 53, 69, 0.8)' }}></span>
                    <span>Intruder</span>
                    <span className={`badge rounded-pill ${timelineFilter === 'UNKNOWN' ? 'bg-white text-danger' : 'bg-danger text-white'}`} style={{ fontSize: '0.7rem' }}>
                      {todayIntruderCount}
                    </span>
                  </button>

                  <button
                    type="button"
                    className={`btn btn-sm rounded-pill px-3 py-1.5 fw-bold d-inline-flex align-items-center gap-2 transition-all ${timelineFilter === 'KNOWN' ? 'shadow-sm' : 'border-0'
                      }`}
                    style={{
                      background: timelineFilter === 'KNOWN' ? '#198754' : 'rgba(25, 135, 84, 0.08)',
                      color: timelineFilter === 'KNOWN' ? '#ffffff' : '#198754',
                      border: '1px solid rgba(25, 135, 84, 0.25)',
                      fontSize: '0.78rem'
                    }}
                    onClick={() => setTimelineFilter(timelineFilter === 'KNOWN' ? 'ALL' : 'KNOWN')}
                    title="Click to filter Known personnel"
                  >
                    <span className="rounded-circle d-inline-block" style={{ width: '8px', height: '8px', background: timelineFilter === 'KNOWN' ? '#ffffff' : '#198754', boxShadow: '0 0 6px rgba(25, 135, 84, 0.8)' }}></span>
                    <span>Known</span>
                    <span className={`badge rounded-pill ${timelineFilter === 'KNOWN' ? 'bg-white text-success' : 'bg-success text-white'}`} style={{ fontSize: '0.7rem' }}>
                      {todayKnownCount}
                    </span>
                  </button>
                </div>
              </div>

              {/* Scrubber Track Section with Horizontal Smooth Scroll */}
              <div className="position-relative pt-2 pb-2">
                <div className="d-flex justify-content-between align-items-center mb-1 text-muted d-sm-none">
                  <span className="small d-inline-flex align-items-center gap-1 opacity-75" style={{ fontSize: '0.7rem' }}>
                    <i className="bi bi-arrows-expand"></i> Swipe to scroll full 24h timeline
                  </span>
                </div>

                <div
                  ref={timelineScrollRef}
                  className="timeline-horizontal-scroll"
                  style={{
                    overflowX: 'auto',
                    overflowY: 'visible',
                    WebkitOverflowScrolling: 'touch',
                    paddingTop: '26px',
                    paddingBottom: '32px',
                    paddingLeft: '10px',
                    paddingRight: '10px'
                  }}
                >
                  <div style={{ minWidth: '650px', position: 'relative' }}>
                    <div
                      className="w-100 rounded-pill position-relative overflow-visible"
                      style={{
                        height: '30px',
                        background: 'linear-gradient(90deg, rgba(13, 110, 253, 0.04) 0%, rgba(13, 110, 253, 0.09) 50%, rgba(13, 110, 253, 0.04) 100%)',
                        border: '1.5px solid rgba(13, 110, 253, 0.22)',
                        boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.05)'
                      }}
                    >
                      {/* Subtle Grid Divider Lines (every 2 hours) */}
                      {[0, 8.33, 16.66, 25, 33.33, 41.66, 50, 58.33, 66.66, 75, 83.33, 91.66, 100].map((pct, i) => (
                        <div
                          key={i}
                          className="position-absolute"
                          style={{
                            left: `${pct}%`,
                            top: '0',
                            bottom: '0',
                            width: '1px',
                            background: 'rgba(13, 110, 253, 0.16)',
                            pointerEvents: 'none'
                          }}
                        ></div>
                      ))}

                      {/* "NOW" Live Current Time Needle */}
                      <div
                        className="position-absolute"
                        style={{
                          left: `${nowPosPct}%`,
                          top: '-6px',
                          bottom: '-6px',
                          width: '2px',
                          background: '#0dcaf0',
                          boxShadow: '0 0 10px #0dcaf0',
                          zIndex: 8,
                          pointerEvents: 'none',
                          transform: 'translateX(-50%)'
                        }}
                      >
                        <span
                          className="position-absolute badge rounded-pill bg-info text-dark fw-bold px-2 py-0.5 shadow-sm"
                          style={{
                            top: '-22px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            fontSize: '0.64rem',
                            letterSpacing: '0.3px',
                            whiteSpace: 'nowrap',
                            boxShadow: '0 2px 8px rgba(13, 202, 240, 0.4)'
                          }}
                        >
                          NOW {nowTimeStr}
                        </span>
                      </div>

                      {/* Detection Markers */}
                      {staggeredReports.length > 0 ? (
                        staggeredReports.map((rep, idx) => {
                          const isUnknown = rep.status === 'UNKNOWN';
                          const topOffset = rep.offsetIdx === 1 ? '-4px' : (rep.offsetIdx === 2 ? '12px' : '3px');

                          return (
                            <div
                              key={rep.id || idx}
                              className="position-absolute rounded-circle cursor-pointer transition-all"
                              style={{
                                left: `${rep.posPct}%`,
                                top: topOffset,
                                width: '24px',
                                height: '24px',
                                background: isUnknown
                                  ? 'linear-gradient(135deg, #ef4444, #dc3545)'
                                  : 'linear-gradient(135deg, #10b981, #198754)',
                                border: '2px solid #ffffff',
                                boxShadow: isUnknown
                                  ? '0 0 10px rgba(220, 53, 69, 0.9), 0 2px 4px rgba(0,0,0,0.2)'
                                  : '0 0 10px rgba(25, 135, 84, 0.9), 0 2px 4px rgba(0,0,0,0.2)',
                                zIndex: isUnknown ? 6 : 4,
                                transform: 'translateX(-50%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#ffffff',
                                fontSize: '0.66rem'
                              }}
                              onMouseEnter={() => setHoveredScrubberEvent(rep)}
                              onMouseLeave={() => setHoveredScrubberEvent(null)}
                              onClick={() => {
                                if (rep.imageUrl) setSelectedImage(rep.imageUrl);
                              }}
                            >
                              <i className={`bi ${isUnknown ? 'bi-shield-fill-exclamation' : 'bi-check-lg'}`}></i>
                            </div>
                          );
                        })
                      ) : (
                        <div className="w-100 h-100 d-flex align-items-center justify-content-center">
                          <span className="small text-secondary fw-semibold" style={{ fontSize: '0.78rem' }}>
                            No detections recorded for today yet.
                          </span>
                        </div>
                      )}
                    </div>

                    {/* 24-Hour Time Marks */}
                    <div className="position-absolute w-100 d-flex justify-content-between px-1" style={{ top: '38px', fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600, fontFamily: 'monospace' }}>
                      <span>00:00</span>
                      <span>02:00</span>
                      <span>04:00</span>
                      <span>06:00</span>
                      <span>08:00</span>
                      <span>10:00</span>
                      <span>12:00</span>
                      <span>14:00</span>
                      <span>16:00</span>
                      <span>18:00</span>
                      <span>20:00</span>
                      <span>22:00</span>
                      <span>23:59</span>
                    </div>

                    {/* Floating Interactive Hover Tooltip */}
                    {hoveredScrubberEvent && (
                      <div
                        className="position-absolute card border shadow-lg p-2.5 rounded-3 animate-fade-in"
                        style={{
                          left: `${Math.min(85, Math.max(15, hoveredScrubberEvent.posPct))}%`,
                          top: '-100px',
                          transform: 'translateX(-50%)',
                          zIndex: 20,
                          minWidth: '220px',
                          background: 'var(--bg-surface-solid, #ffffff)',
                          borderColor: hoveredScrubberEvent.status === 'UNKNOWN' ? 'rgba(220, 53, 69, 0.4)' : 'rgba(25, 135, 84, 0.4)',
                          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)'
                        }}
                      >
                        <div className="d-flex align-items-center gap-2.5">
                          {hoveredScrubberEvent.imageUrl ? (
                            <img
                              src={hoveredScrubberEvent.imageUrl}
                              alt="Capture"
                              className="rounded-2 flex-shrink-0"
                              style={{ width: '42px', height: '42px', objectFit: 'cover', border: '1px solid rgba(0,0,0,0.1)' }}
                            />
                          ) : (
                            <div
                              className="rounded-2 d-flex align-items-center justify-content-center flex-shrink-0"
                              style={{
                                width: '42px',
                                height: '42px',
                                background: hoveredScrubberEvent.status === 'UNKNOWN' ? 'rgba(220,53,69,0.1)' : 'rgba(25,135,84,0.1)',
                                color: hoveredScrubberEvent.status === 'UNKNOWN' ? '#dc3545' : '#198754'
                              }}
                            >
                              <i className={`bi ${hoveredScrubberEvent.status === 'UNKNOWN' ? 'bi-shield-exclamation fs-5' : 'bi-person-check fs-5'}`}></i>
                            </div>
                          )}
                          <div className="flex-grow-1 min-w-0">
                            <div className="d-flex align-items-center justify-content-between gap-1 mb-0.5">
                              <strong className="text-truncate fw-bold text-dynamic" style={{ fontSize: '0.82rem' }}>
                                {hoveredScrubberEvent.person_name || 'Unknown Person'}
                              </strong>
                              <span
                                className={`badge rounded-pill ${hoveredScrubberEvent.status === 'UNKNOWN' ? 'bg-danger text-white' : 'bg-success text-white'}`}
                                style={{ fontSize: '0.62rem' }}
                              >
                                {hoveredScrubberEvent.status}
                              </span>
                            </div>
                            <div className="text-secondary small d-flex align-items-center gap-1.5" style={{ fontSize: '0.7rem' }}>
                              <i className="bi bi-clock"></i>
                              <span>{hoveredScrubberEvent.dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                            </div>
                            <div className="text-secondary small text-truncate" style={{ fontSize: '0.68rem' }}>
                              <i className="bi bi-camera me-1"></i>
                              <span>{hoveredScrubberEvent.camera_name}</span>
                            </div>
                          </div>
                        </div>
                        {hoveredScrubberEvent.imageUrl && (
                          <div className="mt-1.5 pt-1.5 border-top border-secondary border-opacity-10 text-center">
                            <span className="text-primary fw-semibold" style={{ fontSize: '0.68rem' }}>
                              Click to inspect snapshot <i className="bi bi-box-arrow-up-right ms-0.5"></i>
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Quick Stats Cards Section */}
        <div className="row g-3 mb-4">

          {/* Total Detections Card */}
          <div className="col-12 col-md-4" data-reveal="true" data-reveal-delay="0">
            <div className="stat-card stat-card-blue p-4 d-flex align-items-center justify-content-between h-100" style={{ borderRadius: '20px' }}>
              <div className="d-flex align-items-center gap-2">
                <div className="d-flex align-items-center justify-content-center rounded flex-shrink-0" style={{ width: '40px', height: '40px', background: 'rgba(13, 110, 253, 0.1)' }}>
                  <i className="bi bi-cpu" style={{ color: '#2563eb', fontSize: '1.15rem' }}></i>
                </div>
                <div>
                  <h6 className="mb-0 fw-bold text-dynamic" style={{ fontSize: '0.95rem' }}>Total Detections</h6>
                  <span className="text-secondary d-block" style={{ fontSize: '0.75rem', fontWeight: '600', letterSpacing: '0.5px', textTransform: 'uppercase', lineHeight: 1.2 }}>All Events</span>
                </div>
              </div>
              <div className="rounded-circle d-flex align-items-center justify-content-center text-white shadow font-mono"
                style={{ width: '56px', height: '56px', fontSize: '1.4rem', fontWeight: '800', background: '#2563eb', border: '3px solid rgba(255,255,255,0.1)' }}>
                {totalDetections}
              </div>
            </div>
          </div>

          {/* Known Personnel Visits Card */}
          <div className="col-12 col-md-4" data-reveal="true" data-reveal-delay="100">
            <div className="stat-card stat-card-green p-4 d-flex align-items-center justify-content-between h-100" style={{ borderRadius: '20px' }}>
              <div className="d-flex align-items-center gap-2">
                <div className="d-flex align-items-center justify-content-center rounded flex-shrink-0" style={{ width: '40px', height: '40px', background: 'rgba(25, 135, 84, 0.1)' }}>
                  <i className="bi bi-person-check-fill" style={{ color: '#198754', fontSize: '1.15rem' }}></i>
                </div>
                <div>
                  <h6 className="mb-0 fw-bold text-dynamic" style={{ fontSize: '0.95rem' }}>Known Personnel</h6>
                  <span className="text-secondary d-block" style={{ fontSize: '0.75rem', fontWeight: '600', letterSpacing: '0.5px', textTransform: 'uppercase', lineHeight: 1.2 }}>Verified</span>
                </div>
              </div>
              <div className="rounded-circle d-flex align-items-center justify-content-center text-white shadow font-mono"
                style={{ width: '56px', height: '56px', fontSize: '1.4rem', fontWeight: '800', background: 'linear-gradient(135deg, #198754, #20c997)', border: '3px solid rgba(255,255,255,0.1)' }}>
                {knownDetections}
              </div>
            </div>
          </div>

          {/* Unknown Intrusions Card */}
          <div className="col-12 col-md-4" data-reveal="true" data-reveal-delay="200">
            <div className="stat-card stat-card-red p-4 d-flex align-items-center justify-content-between h-100" style={{ borderRadius: '20px' }}>
              <div className="d-flex align-items-center gap-2">
                <div className="d-flex align-items-center justify-content-center rounded flex-shrink-0" style={{ width: '40px', height: '40px', background: 'rgba(220, 53, 69, 0.1)' }}>
                  <i className="bi bi-person-fill-exclamation" style={{ color: '#dc3545', fontSize: '1.15rem' }}></i>
                </div>
                <div>
                  <h6 className="mb-0 fw-bold text-dynamic" style={{ fontSize: '0.95rem' }}>Unknown Intrusions</h6>
                  <span className="text-secondary d-block" style={{ fontSize: '0.75rem', fontWeight: '600', letterSpacing: '0.5px', textTransform: 'uppercase', lineHeight: 1.2 }}>Unverified</span>
                </div>
              </div>
              <div className="rounded-circle d-flex align-items-center justify-content-center text-white shadow font-mono"
                style={{ width: '56px', height: '56px', fontSize: '1.4rem', fontWeight: '800', background: 'linear-gradient(135deg, #dc3545, #f87171)', border: '3px solid rgba(255,255,255,0.1)' }}>
                {unknownDetections}
              </div>
            </div>
          </div>
        </div>

        {/* Frequent Persons Grid Section */}
        <div className="row mb-4" data-reveal="true" data-reveal-delay="100">
          <div className="col-12">
            <div className="p-4 glass-card">
              <h4 className="text-dynamic fw-bold mb-4 d-flex align-items-center gap-2">
                <i className="bi bi-people-fill text-primary"></i>
                <span>Most Frequent Persons</span>
              </h4>

              <div className="row g-3">
                {frequentPersons.length > 0 ? frequentPersons.map((person, index) => (
                  <div className="col-lg-4 col-md-6" key={index} data-reveal="true" data-reveal-delay={`${index * 10}`}>
                    <div className="p-4 rounded-4 glass-card frequent-card h-100 d-flex flex-column justify-content-between"
                      style={{ '--card-border-color': person.status === 'KNOWN' ? '#198754' : '#dc3545' }}>

                      <div>
                        <div className="d-flex align-items-center justify-content-between mb-3">
                          <div className="d-flex align-items-center gap-3">
                            <div className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                              style={{ width: '45px', height: '45px', background: 'color-mix(in srgb, var(--card-border-color) 15%, transparent)', border: '1px solid color-mix(in srgb, var(--card-border-color) 30%, transparent)' }}>
                              {person.status === 'KNOWN' ? (
                                <i className="bi bi-person-check-fill fs-4" style={{ color: 'var(--card-border-color)', lineHeight: 0 }}></i>
                              ) : (
                                <i className="bi bi-person-fill-exclamation fs-4" style={{ color: 'var(--card-border-color)', lineHeight: 0 }}></i>
                              )}
                            </div>
                            <div>
                              <h5 className="text-dynamic fw-bold mb-0" style={{ fontSize: '1.1rem' }}>{person.name}</h5>
                              <span className={`small fw-bold ${person.status === 'KNOWN' ? 'text-success' : 'text-danger'} text-uppercase`}
                                style={{ fontSize: '0.75rem', letterSpacing: '0.5px' }}>
                                {person.status}
                              </span>
                            </div>
                          </div>
                          <span className="badge rounded-pill px-3 py-1.5 fw-bold text-uppercase"
                            style={{ fontSize: '0.75rem', background: 'rgba(13, 110, 253, 0.15)', color: '#2563eb', border: '1px solid rgba(13, 110, 253, 0.3)' }}>
                            Total: {person.total_count}
                          </span>
                        </div>

                        <div className="row g-2 mb-3">
                          <div className="col-6">
                            <div className="p-3 bg-inner-card rounded-3 text-center">
                              <span className="small text-secondary fw-bold text-uppercase d-block mb-1" style={{ fontSize: '0.7rem', letterSpacing: '0.5px' }}>This Week</span>
                              <span className="fs-4 text-dynamic fw-bold">{person.weekly_count}</span>
                            </div>
                          </div>
                          <div className="col-6">
                            <div className="p-3 bg-inner-card rounded-3 text-center">
                              <span className="small text-secondary fw-bold text-uppercase d-block mb-1" style={{ fontSize: '0.7rem', letterSpacing: '0.5px' }}>This Month</span>
                              <span className="fs-4 text-dynamic fw-bold">{person.monthly_count}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="border-top border-white border-opacity-5 pt-3 mt-auto">
                        <span className="small text-secondary d-flex align-items-center gap-2" style={{ fontSize: '0.825rem' }}>
                          <i className="bi bi-eye text-primary fs-6"></i>
                          <span>Last Seen:</span>
                          <strong className="text-dynamic font-mono">{person.last_seen}</strong>
                        </span>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="col-12 text-center py-4 text-secondary">
                    <i className="bi bi-person-x display-5 text-muted mb-2 d-block"></i>
                    <span className="fw-semibold">No active personnel logs registered yet to calculate frequencies.</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="row mb-4" data-reveal="true">
          <div className="col-12">
            <div className="p-4 glass-card">
              {/* Header Row: Title on Left, Mode Switcher on Right (PC/Laptop) */}
              <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 mb-3">
                <div>
                  <h5 className="text-dynamic fw-bold mb-0 d-flex align-items-center gap-2">
                    <i className="bi bi-bar-chart-fill text-primary"></i>
                    Analytics Overview
                  </h5>
                  <p className="text-secondary small mb-0 mt-1">Switch between daily detection trends and overall distribution.</p>
                </div>
                <div className="chart-switcher-container mx-auto mx-md-0">
                  <button type="button" className={`switcher-btn ${activeChart === 'bar' ? 'active' : ''}`} onClick={() => setActiveChart('bar')}>Daily Trends</button>
                  <button type="button" className={`switcher-btn ${activeChart === 'doughnut' ? 'active' : ''}`} onClick={() => setActiveChart('doughnut')}>Distribution</button>
                </div>
              </div>

              {/* Bar Chart Filters Row: Scope Filter on Left, Timeframe Filter on Right (PC/Laptop) */}
              {activeChart === 'bar' && (
                <div className="d-flex flex-column flex-md-row align-items-center justify-content-between gap-3 mb-3 px-1">
                  <div className="chart-switcher-container">
                    {[
                      { id: 'ALL', label: 'All', color: '#2563eb' },
                      { id: 'KNOWN', label: 'Known', color: '#10b981' },
                      { id: 'UNKNOWN', label: 'Unknown', color: '#ef4444' }
                    ].map(scopeOpt => {
                      const isSelected = chartScope === scopeOpt.id;
                      return (
                        <button
                          key={scopeOpt.id}
                          type="button"
                          onClick={() => setChartScope(scopeOpt.id)}
                          className={`switcher-btn ${isSelected ? 'active' : ''} d-inline-flex align-items-center`}
                          style={{
                            gap: '6px',
                            padding: '4px 14px',
                            fontSize: '0.78rem',
                            background: isSelected ? scopeOpt.color : 'transparent',
                            color: isSelected ? '#ffffff' : 'var(--text-heading)',
                            borderColor: isSelected ? scopeOpt.color : 'transparent'
                          }}
                        >
                          <span
                            className="rounded-circle d-inline-block flex-shrink-0"
                            style={{
                              width: '7px',
                              height: '7px',
                              background: isSelected ? '#ffffff' : scopeOpt.color,
                              boxShadow: isSelected ? '0 0 6px rgba(255,255,255,0.8)' : `0 0 6px ${scopeOpt.color}`
                            }}
                          ></span>
                          <span>{scopeOpt.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="chart-switcher-container">
                    {[
                      { id: '7D', label: '7 Days' },
                      { id: '10D', label: '10 Days' },
                      { id: '14D', label: '14 Days' },
                      { id: '30D', label: '30 Days' },
                      { id: 'ALL', label: 'All' }
                    ].map(tf => (
                      <button
                        key={tf.id}
                        type="button"
                        onClick={() => setChartTimeframe(tf.id)}
                        className={`switcher-btn ${chartTimeframe === tf.id ? 'active' : ''}`}
                        style={{ padding: '4px 12px', fontSize: '0.78rem' }}
                      >
                        {tf.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Daily Trends SVG Bar Chart */}
              <div style={{ minHeight: '380px', position: 'relative', display: activeChart === 'bar' ? 'block' : 'none' }}>
                {dailyCounts.length > 0 ? (
                  <div className="w-100 h-100 d-flex flex-column justify-content-between pt-2">

                    {/* Scrollable Large Bar Canvas Track */}
                    <div className="w-100 overflow-x-auto custom-scrollbar pb-2">
                      <div className="d-flex align-items-end justify-content-around px-2 pb-3 border-bottom border-secondary border-opacity-25" style={{ height: '300px', minWidth: '700px' }}>
                        {dailyCounts.map((item, idx) => {
                          const showKnown = (chartScope === 'ALL' || chartScope === 'KNOWN') && item.known > 0;
                          const showUnknown = (chartScope === 'ALL' || chartScope === 'UNKNOWN') && item.unknown > 0;

                          const maxVal = Math.max(
                            ...dailyCounts.map(d => {
                              if (chartScope === 'KNOWN') return d.known;
                              if (chartScope === 'UNKNOWN') return d.unknown;
                              return Math.max(d.known, d.unknown);
                            }),
                            1
                          );
                          const knownPx = item.known > 0 ? Math.max(12, Math.round((item.known / maxVal) * 220)) : 0;
                          const unknownPx = item.unknown > 0 ? Math.max(12, Math.round((item.unknown / maxVal) * 220)) : 0;

                          return (
                            <div key={idx} className="d-flex flex-column align-items-center flex-grow-1 justify-content-end px-2" style={{ height: '100%' }}>
                              <div className="d-flex align-items-end gap-1.5 mb-1.5">
                                {/* Known Bar (Blue) */}
                                {showKnown && (
                                  <div className="d-flex flex-column align-items-center">
                                    <span className="small font-mono fw-bold text-primary mb-1" style={{ fontSize: '0.78rem' }}>{item.known}</span>
                                    <div
                                      className="transition-all cursor-pointer hover-glow"
                                      style={{
                                        height: `${knownPx}px`,
                                        width: '20px',
                                        background: '#2563eb',
                                        boxShadow: '0 4px 16px rgba(13, 110, 253, 0.45)',
                                        borderRadius: '6px 6px 3px 3px'
                                      }}
                                      title={`${item.date} Known: ${item.known}`}
                                    ></div>
                                  </div>
                                )}

                                {/* Unknown Bar (Red) */}
                                {showUnknown && (
                                  <div className="d-flex flex-column align-items-center">
                                    <span className="small font-mono fw-bold text-danger mb-1" style={{ fontSize: '0.78rem' }}>{item.unknown}</span>
                                    <div
                                      className="transition-all cursor-pointer hover-glow"
                                      style={{
                                        height: `${unknownPx}px`,
                                        width: '20px',
                                        background: 'linear-gradient(180deg, #f87171 0%, #ef4444 100%)',
                                        boxShadow: '0 4px 16px rgba(239, 68, 68, 0.45)',
                                        borderRadius: '6px 6px 3px 3px'
                                      }}
                                      title={`${item.date} Unknown: ${item.unknown}`}
                                    ></div>
                                  </div>
                                )}
                              </div>

                              <span className="small text-secondary font-mono mt-2 fw-semibold text-nowrap" style={{ fontSize: '0.75rem' }}>{item.date}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="d-flex align-items-center justify-content-center py-5 text-secondary">
                    <span>No detection trend data available</span>
                  </div>
                )}
              </div>

              {/* Distribution SVG Doughnut Chart */}
              <div style={{ minHeight: '280px', position: 'relative', display: activeChart === 'doughnut' ? 'flex' : 'none', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                {totalDetectionsCount > 0 ? (
                  <div className="d-flex flex-column flex-sm-row align-items-center justify-content-center gap-4 w-100 py-3">
                    <div className="position-relative d-flex align-items-center justify-content-center" style={{ width: '180px', height: '180px' }}>
                      <svg width="180" height="180" viewBox="0 0 180 180" style={{ transform: 'rotate(-90deg)' }}>
                        <circle cx="90" cy="90" r="70" stroke="rgba(255,255,255,0.06)" strokeWidth="20" fill="transparent" />
                        {/* Known Slice (Blue) */}
                        <circle
                          cx="90"
                          cy="90"
                          r="70"
                          stroke="#2563eb"
                          strokeWidth="20"
                          fill="transparent"
                          strokeDasharray={439.8}
                          strokeDashoffset={439.8 - (439.8 * (knownPct / 100))}
                          strokeLinecap="round"
                          style={{ transition: 'stroke-dashoffset 0.8s ease-in-out' }}
                        />
                        {/* Unknown Slice (Red) */}
                        <circle
                          cx="90"
                          cy="90"
                          r="70"
                          stroke="#ef4444"
                          strokeWidth="20"
                          fill="transparent"
                          strokeDasharray={439.8}
                          strokeDashoffset={439.8 - (439.8 * (unknownPct / 100))}
                          strokeLinecap="round"
                          style={{
                            transform: `rotate(${(knownPct / 100) * 360}deg)`,
                            transformOrigin: '90px 90px',
                            transition: 'stroke-dashoffset 0.8s ease-in-out'
                          }}
                        />
                      </svg>
                      <div className="position-absolute text-center">
                        <span className="fs-3 font-mono fw-bold text-dynamic d-block" style={{ lineHeight: '1' }}>{totalDetectionsCount}</span>
                        <span className="small text-secondary text-uppercase fw-bold" style={{ fontSize: '0.65rem', letterSpacing: '1px' }}>Total Logs</span>
                      </div>
                    </div>

                    <div className="d-flex flex-column gap-2 ms-sm-3">
                      <div className="d-flex align-items-center gap-3 p-3 rounded-3 bg-inner-card" style={{ minWidth: '200px' }}>
                        <div className="rounded-circle bg-primary" style={{ width: '12px', height: '12px', boxShadow: '0 0 8px #2563eb' }}></div>
                        <div>
                          <span className="d-block small text-secondary fw-semibold">Known Persons</span>
                          <strong className="fs-5 text-primary font-mono">{knownCount} <span className="small text-muted">({knownPct}%)</span></strong>
                        </div>
                      </div>
                      <div className="d-flex align-items-center gap-3 p-3 rounded-3 bg-inner-card" style={{ minWidth: '200px' }}>
                        <div className="rounded-circle bg-danger" style={{ width: '12px', height: '12px', boxShadow: '0 0 8px #ef4444' }}></div>
                        <div>
                          <span className="d-block small text-secondary fw-semibold">Unknown Persons</span>
                          <strong className="fs-5 text-danger font-mono">{unknownCount} <span className="small text-muted">({unknownPct}%)</span></strong>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="d-flex align-items-center justify-content-center py-5 text-secondary">
                    <span>No distribution data available</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Filters & Detection Records Section (Single Combined Glass Card) */}
        <div className="row mb-4" style={{ position: 'relative', zIndex: 100 }} data-reveal="true">
          <div className="col-12">
            <div className="p-4 glass-card" style={{ position: 'relative', zIndex: 100 }}>

              {/* Detection Records Log Header (Moved to Top) */}
              <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 mb-3 pb-2.5 border-bottom border-white border-opacity-10">
                <div>
                  <h5 className="text-dynamic fw-bold mb-0 d-flex align-items-center gap-2">
                    <i className="bi bi-table text-primary"></i>
                    Detection Records Log
                  </h5>
                  <p className="text-secondary small mb-0 mt-1">Detailed list of recognized persons and intrusion logs.</p>
                </div>
              </div>

              {/* Filter Bar Controls (Camera, Person, Timeframe Dropdowns & Actions) */}
              <div className="row g-3 align-items-end mb-4 px-1">
                {/* Camera Dropdown */}
                <div className="col-12 col-sm-6 col-lg-3">
                  <label className="form-label text-secondary small fw-bold text-uppercase mb-2 d-inline-flex align-items-center gap-2">
                    <i className="bi bi-camera-video text-primary fs-6 flex-shrink-0"></i>
                    <span>Camera</span>
                  </label>
                  <div className="dropdown position-relative">
                    <button
                      type="button"
                      className="btn w-100 d-flex align-items-center justify-content-between text-dynamic px-3.5 rounded-pill shadow-xs transition-all hover-glow"
                      style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', fontSize: '0.85rem', height: '42px' }}
                      onClick={() => { setShowCameraDropdown(!showCameraDropdown); setShowPersonDropdown(false); setShowTimeframeDropdown(false); setShowPerPageDropdown(false); }}
                    >
                      <span className="text-truncate d-inline-flex align-items-center gap-2">
                        <i className="bi bi-camera-video text-primary flex-shrink-0"></i>
                        <span>{cameraQuery === 'all' ? 'All Cameras' : cameraQuery}</span>
                      </span>
                      <i className={`bi bi-chevron-down ms-2 small transition-all ${showCameraDropdown ? 'rotate-180' : ''}`} style={{ fontSize: '0.7rem' }}></i>
                    </button>

                    {showCameraDropdown && (
                      <>
                        <div className="position-fixed inset-0" style={{ zIndex: 990 }} onClick={() => setShowCameraDropdown(false)}></div>
                        <div
                          className="position-absolute top-100 mt-2 start-0 w-100 rounded-4 p-2 shadow-lg overflow-hidden"
                          style={{
                            zIndex: 1000,
                            background: 'var(--dropdown-bg, var(--bg-surface-solid, #0f172a))',
                            border: '1px solid var(--dropdown-border, rgba(255, 255, 255, 0.12))',
                            boxShadow: 'var(--shadow-lg, 0 10px 30px rgba(0,0,0,0.25))'
                          }}
                        >
                          {availableCameras.map((cam) => (
                            <button
                              key={cam}
                              type="button"
                              className={`w-100 btn btn-sm text-start rounded-3 px-3 py-2 my-0.5 d-flex align-items-center justify-content-between transition-all ${cameraQuery === cam ? 'bg-primary text-white fw-bold' : 'text-dynamic hover-bg-subtle'
                                }`}
                              style={{ fontSize: '0.85rem' }}
                              onClick={() => {
                                setCameraQuery(cam);
                                setShowCameraDropdown(false);
                              }}
                            >
                              <span className="text-truncate">{cam === 'all' ? 'All Cameras' : cam}</span>
                              {cameraQuery === cam && <i className="bi bi-check2"></i>}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Person Dropdown */}
                <div className="col-12 col-sm-6 col-lg-3">
                  <label className="form-label text-secondary small fw-bold text-uppercase mb-2 d-inline-flex align-items-center gap-2">
                    <i className="bi bi-person text-primary fs-6"></i>
                    <span>Person</span>
                  </label>
                  <div className="dropdown position-relative">
                    <button
                      type="button"
                      className="btn w-100 d-flex align-items-center justify-content-between text-dynamic px-3.5 rounded-pill shadow-xs transition-all hover-glow"
                      style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', fontSize: '0.85rem', height: '42px' }}
                      onClick={() => { setShowPersonDropdown(!showPersonDropdown); setShowCameraDropdown(false); setShowTimeframeDropdown(false); setShowPerPageDropdown(false); }}
                    >
                      <span className="text-truncate d-inline-flex align-items-center gap-2">
                        <i className="bi bi-person text-primary"></i>
                        <span>{statusQuery === 'KNOWN' ? 'Known Persons' : statusQuery === 'UNKNOWN' ? 'Unknown Persons' : 'All Persons'}</span>
                      </span>
                      <i className={`bi bi-chevron-down ms-2 small transition-all ${showPersonDropdown ? 'rotate-180' : ''}`} style={{ fontSize: '0.7rem' }}></i>
                    </button>

                    {showPersonDropdown && (
                      <>
                        <div className="position-fixed inset-0" style={{ zIndex: 990 }} onClick={() => setShowPersonDropdown(false)}></div>
                        <div
                          className="position-absolute top-100 mt-2 start-0 w-100 rounded-4 p-2 shadow-lg overflow-hidden"
                          style={{
                            zIndex: 1000,
                            background: 'var(--dropdown-bg, var(--bg-surface-solid, #0f172a))',
                            border: '1px solid var(--dropdown-border, rgba(255, 255, 255, 0.12))',
                            boxShadow: 'var(--shadow-lg, 0 10px 30px rgba(0,0,0,0.25))'
                          }}
                        >
                          {[
                            { label: 'All Persons', value: 'all' },
                            { label: 'Known Persons', value: 'KNOWN' },
                            { label: 'Unknown Persons', value: 'UNKNOWN' }
                          ].map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              className={`w-100 btn btn-sm text-start rounded-3 px-3 py-2 my-0.5 d-flex align-items-center justify-content-between transition-all ${statusQuery === opt.value ? 'bg-primary text-white fw-bold' : 'text-dynamic hover-bg-subtle'
                                }`}
                              style={{ fontSize: '0.85rem' }}
                              onClick={() => {
                                setStatusQuery(opt.value);
                                setShowPersonDropdown(false);
                              }}
                            >
                              <span>{opt.label}</span>
                              {statusQuery === opt.value && <i className="bi bi-check2"></i>}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Timeframe Dropdown */}
                <div className="col-12 col-sm-6 col-lg-3">
                  <label className="form-label text-secondary small fw-bold text-uppercase mb-2 d-inline-flex align-items-center gap-2">
                    <i className="bi bi-clock-history text-primary fs-6"></i>
                    <span>Timeframe</span>
                  </label>
                  <div className="dropdown position-relative">
                    <button
                      type="button"
                      className="btn w-100 d-flex align-items-center justify-content-between text-dynamic px-3.5 rounded-pill shadow-xs transition-all hover-glow"
                      style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', fontSize: '0.85rem', height: '42px' }}
                      onClick={() => { setShowTimeframeDropdown(!showTimeframeDropdown); setShowCameraDropdown(false); setShowPersonDropdown(false); setShowPerPageDropdown(false); }}
                    >
                      <span className="text-truncate d-inline-flex align-items-center gap-2">
                        <i className="bi bi-calendar3 text-primary"></i>
                        <span>{timeframeQuery === 'week' ? 'Weekly (Last 7 Days)' : timeframeQuery === 'month' ? 'Monthly (This Month)' : timeframeQuery === 'year' ? 'Yearly (This Year)' : timeframeQuery === 'today' ? 'Today' : timeframeQuery.startsWith('year-') ? `Year ${timeframeQuery.split('-')[1]}` : 'All Time'}</span>
                      </span>
                      <i className={`bi bi-chevron-down ms-2 small transition-all ${showTimeframeDropdown ? 'rotate-180' : ''}`} style={{ fontSize: '0.7rem' }}></i>
                    </button>

                    {showTimeframeDropdown && (
                      <>
                        <div className="position-fixed inset-0" style={{ zIndex: 990 }} onClick={() => setShowTimeframeDropdown(false)}></div>
                        <div
                          className="position-absolute top-100 mt-2 start-0 w-100 rounded-4 p-2 shadow-lg overflow-hidden"
                          style={{
                            zIndex: 1000,
                            background: 'var(--dropdown-bg, var(--bg-surface-solid, #0f172a))',
                            border: '1px solid var(--dropdown-border, rgba(255, 255, 255, 0.12))',
                            boxShadow: 'var(--shadow-lg, 0 10px 30px rgba(0,0,0,0.25))'
                          }}
                        >
                          {[
                            { label: 'Weekly (Last 7 Days)', value: 'week' },
                            { label: 'Monthly (This Month)', value: 'month' },
                            { label: 'Yearly (This Year)', value: 'year' },
                            { label: 'Today', value: 'today' },
                            { label: 'All Time', value: 'all' },
                            ...availableYears.map(yr => ({ label: `Year ${yr}`, value: `year-${yr}` }))
                          ].map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              className={`w-100 btn btn-sm text-start rounded-3 px-3 py-2 my-0.5 d-flex align-items-center justify-content-between transition-all ${timeframeQuery === opt.value ? 'bg-primary text-white fw-bold' : 'text-dynamic hover-bg-subtle'
                                }`}
                              style={{ fontSize: '0.85rem' }}
                              onClick={() => {
                                setTimeframeQuery(opt.value);
                                setShowTimeframeDropdown(false);
                              }}
                            >
                              <span>{opt.label}</span>
                              {timeframeQuery === opt.value && <i className="bi bi-check2"></i>}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Apply & Reset Filter Actions */}
                <div className="col-12 col-sm-6 col-lg-3">
                  <label className="form-label d-none d-lg-block text-secondary small fw-bold text-uppercase mb-2" style={{ visibility: 'hidden' }}>Actions</label>
                  <div className="d-flex align-items-center gap-2 w-100">
                    <button
                      type="button"
                      className="btn btn-primary rounded-pill fw-bold text-nowrap d-flex align-items-center justify-content-center gap-2 shadow-primary flex-grow-1"
                      style={{ fontSize: '0.85rem', height: '42px', padding: '0 20px' }}
                      onClick={() => setCurrentPage(1)}
                    >
                      <i className="bi bi-funnel-fill"></i>
                      <span>Apply</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-secondary rounded-circle d-flex align-items-center justify-content-center flex-shrink-0 transition-all hover-glow"
                      style={{ width: '42px', height: '42px', border: '1px solid var(--border-input)', background: 'var(--bg-input)' }}
                      title="Reset All Filters"
                      onClick={() => { setSearchQuery(''); setCameraQuery('all'); setStatusQuery('all'); setTimeframeQuery('all'); setCurrentPage(1); }}
                    >
                      <i className="bi bi-arrow-counterclockwise text-secondary fs-6"></i>
                    </button>
                  </div>
                </div>
              </div>

              {/* Responsive Table Container */}
              <div className="table-responsive" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%' }}>
                <table className="table custom-table table-hover align-middle mb-0" style={{ minWidth: '860px', width: '100%' }}>
                  <thead>
                    <tr>
                      <th scope="col" style={{ width: '13%' }}>Date</th>
                      <th scope="col" style={{ width: '16%' }}>Camera</th>
                      <th scope="col" style={{ width: '18%' }}>Person Name</th>
                      <th scope="col" style={{ width: '13%' }} className="text-center">Classification</th>
                      <th scope="col" style={{ width: '14%' }} className="text-center">Entry Time (First Seen)</th>
                      <th scope="col" style={{ width: '14%' }} className="text-center">Exit Time (Last Seen)</th>
                      <th scope="col" style={{ width: '12%' }} className="text-center">Detections (Freq)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentReports.length > 0 ? currentReports.map((rep, index) => (
                      <tr key={index}>
                        <td className="text-secondary fw-semibold">
                          <div className="d-flex align-items-center gap-2">
                            <i className="bi bi-calendar3 text-primary"></i>
                            <span>{rep.date}</span>
                          </div>
                        </td>
                        <td className="text-secondary fw-semibold">
                          <div className="d-flex align-items-center gap-2">
                            <i className="bi bi-camera-video text-primary"></i>
                            <span className="text-truncate" style={{ maxWidth: '160px' }}>{rep.camera_name || "Default Camera"}</span>
                          </div>
                        </td>
                        <td>
                          <div className="d-flex align-items-center gap-2.5">
                            <div className={`rounded-circle d-flex align-items-center justify-content-center flex-shrink-0 ${rep.status === 'KNOWN' ? 'bg-primary bg-opacity-10 text-primary' : 'bg-danger bg-opacity-10 text-danger'}`}
                              style={{ width: '36px', height: '36px', border: rep.status === 'KNOWN' ? '1px solid rgba(13, 110, 253, 0.25)' : '1px solid rgba(220, 53, 69, 0.25)' }}>
                              {rep.status === 'KNOWN' ? (
                                <i className="bi bi-person-fill fs-6"></i>
                              ) : (
                                <i className="bi bi-person-fill-exclamation fs-6"></i>
                              )}
                            </div>
                            <span className={`fw-bold text-truncate ${rep.status === 'KNOWN' ? 'text-dynamic' : 'text-danger'}`} style={{ maxWidth: '150px' }}>
                              {rep.person_name || "Unknown Person"}
                            </span>
                          </div>
                        </td>
                        <td className="text-center">
                          {rep.status === 'KNOWN' ? (
                            <span className="badge badge-known">Known</span>
                          ) : (
                            <span className="badge badge-unknown">Unknown</span>
                          )}
                        </td>
                        <td className="text-center">
                          <span className="badge rounded-pill bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-2.5 py-1.5 font-mono d-inline-flex align-items-center gap-1.5" style={{ fontSize: '0.825rem' }}>
                            <i className="bi bi-box-arrow-in-right"></i>
                            <span>{rep.entry_time}</span>
                          </span>
                        </td>
                        <td className="text-center">
                          <span className="badge rounded-pill bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 px-2.5 py-1.5 font-mono d-inline-flex align-items-center gap-1.5" style={{ fontSize: '0.825rem' }}>
                            <i className="bi bi-box-arrow-left"></i>
                            <span>{rep.exit_time}</span>
                          </span>
                        </td>
                        <td className="text-center">
                          <span className="badge rounded-pill px-3 py-1.5 fw-bold font-mono" style={{ background: 'rgba(13, 110, 253, 0.15)', color: '#3b82f6', border: '1px solid rgba(13, 110, 253, 0.3)', fontSize: '0.85rem' }}>
                            {rep.frequency}
                          </span>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan="7" className="text-center py-5 text-secondary">
                          <div className="py-4 d-flex flex-column align-items-center justify-content-center">
                            <div className="rounded-circle bg-primary bg-opacity-10 d-flex align-items-center justify-content-center mb-3" style={{ width: '64px', height: '64px', border: '1px solid rgba(13, 110, 253, 0.2)' }}>
                              <i className="bi bi-search text-primary fs-2"></i>
                            </div>
                            <p className="fs-5 mb-1 text-dynamic fw-bold">No Records Found</p>
                            <p className="small text-muted mb-0">No detection logs match your selected camera, person, or timeframe filters.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {totalItems > 0 && (
                <div className="custom-pagination-bar d-flex flex-column flex-md-row align-items-center justify-content-between gap-3 p-3">
                  <div className="d-flex flex-wrap align-items-center justify-content-center justify-content-md-start gap-2 gap-sm-3">
                    <span className="small text-secondary font-mono text-center" style={{ fontSize: '0.8rem' }}>
                      Showing <strong className="text-dynamic">{startIndex + 1}</strong> to <strong className="text-dynamic">{endIndex}</strong> of <strong className="text-dynamic">{totalItems}</strong> entries
                    </span>
                    <div className="d-flex align-items-center gap-2 ms-sm-2">
                      <span className="small text-secondary fw-semibold text-nowrap m-0" style={{ fontSize: '0.8rem' }}>Per page:</span>
                      <div className="dropdown position-relative">
                        <button
                          type="button"
                          className="btn btn-sm d-flex align-items-center gap-2 rounded-pill px-3 py-1.5 text-nowrap"
                          style={{
                            background: 'rgba(13, 110, 253, 0.05)',
                            border: '1px solid rgba(13, 110, 253, 0.15)',
                            color: 'var(--text-heading)',
                            fontSize: '0.825rem',
                            fontWeight: 600
                          }}
                          onClick={() => setShowPerPageDropdown(!showPerPageDropdown)}
                        >
                          <span>{itemsPerPage}</span>
                          <i className={`bi bi-chevron-down small transition-all ${showPerPageDropdown ? 'rotate-180' : ''}`} style={{ fontSize: '0.7rem' }}></i>
                        </button>

                        {showPerPageDropdown && (
                          <>
                            <div className="position-fixed inset-0" style={{ zIndex: 990 }} onClick={() => setShowPerPageDropdown(false)}></div>
                            <div
                              className="position-absolute bottom-100 mb-2 start-0 rounded-4 p-1.5 shadow-lg overflow-hidden"
                              style={{
                                zIndex: 1000,
                                minWidth: '95px',
                                background: 'var(--bg-glass-card, #ffffff)',
                                border: '1px solid var(--border-color, rgba(0, 0, 0, 0.12))',
                                boxShadow: '0 10px 30px rgba(0, 0, 0, 0.18)',
                              }}
                            >
                              {[5, 10, 20, 50].map((num) => (
                                <button
                                  key={num}
                                  type="button"
                                  className="w-100 btn btn-sm text-start rounded-3 px-3 py-1.5 my-0.5 d-flex align-items-center justify-content-between transition-all"
                                  style={{
                                    fontSize: '0.8rem',
                                    background: itemsPerPage === num ? '#2563eb' : 'transparent',
                                    color: itemsPerPage === num ? '#ffffff' : 'var(--text-heading)',
                                    fontWeight: itemsPerPage === num ? 700 : 500
                                  }}
                                  onClick={() => {
                                    setItemsPerPage(num);
                                    setCurrentPage(1);
                                    setShowPerPageDropdown(false);
                                  }}
                                >
                                  <span>{num}</span>
                                  {itemsPerPage === num && <i className="bi bi-check2"></i>}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <nav aria-label="Reports Pagination">
                    <div className="d-flex align-items-center gap-2">
                      <button
                        type="button"
                        className="custom-page-btn rounded-circle"
                        style={{ width: '34px', height: '34px' }}
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        title="Previous Page"
                      >
                        <span style={{ color: 'var(--text-heading)' }}><i className="bi bi-chevron-left"></i></span>
                      </button>

                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(page => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1)
                        .map((page, idx, arr) => {
                          const prevPage = arr[idx - 1];
                          const showEllipsis = prevPage && page - prevPage > 1;

                          return (
                            <React.Fragment key={page}>
                              {showEllipsis && (
                                <span className="text-secondary px-1 small font-mono">...</span>
                              )}
                              <button
                                type="button"
                                className={`custom-page-btn rounded-circle ${currentPage === page ? 'active' : ''}`}
                                style={{
                                  width: '34px',
                                  height: '34px',
                                  background: currentPage === page ? '#2563eb' : 'var(--bg-input)',
                                  borderColor: currentPage === page ? '#2563eb' : 'var(--border-subtle)',
                                }}
                                onClick={() => setCurrentPage(page)}
                              >
                                <span style={{ color: currentPage === page ? '#ffffff' : 'var(--text-heading)' }}>{page}</span>
                              </button>
                            </React.Fragment>
                          );
                        })}

                      <button
                        type="button"
                        className="custom-page-btn rounded-circle"
                        style={{ width: '34px', height: '34px' }}
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        title="Next Page"
                      >
                        <span style={{ color: 'var(--text-heading)' }}><i className="bi bi-chevron-right"></i></span>
                      </button>
                    </div>
                  </nav>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Custom Export Modal */}
      {showExportModal && createPortal(
        <>
          {/* Theme-adaptive Dimmed Backdrop */}
          <div
            className="position-fixed"
            style={{
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(15, 23, 42, 0.75)',
              zIndex: 9999
            }}
            onClick={() => setShowExportModal(false)}
          ></div>

          {/* Viewport Modal Container */}
          <div
            className="position-fixed d-flex align-items-center justify-content-center p-3"
            style={{
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 10000,
              pointerEvents: 'none'
            }}
          >
            <div
              className="w-100 my-auto"
              style={{ maxWidth: '480px', pointerEvents: 'auto' }}
            >
              <div
                className="export-modal-card overflow-hidden"
                style={{
                  maxHeight: '95vh',
                  background: 'var(--bg-surface-solid, #0d1117)',
                  color: 'var(--text-heading, #f0f6fc)',
                  borderRadius: '20px',
                  border: '1px solid var(--border-color, rgba(255,255,255,0.08))',
                  boxShadow: '0 32px 80px -10px rgba(0,0,0,0.8)',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                {/* ── Header ── */}
                <div style={{
                  padding: '20px 24px 16px',
                  borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.07))',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  flexShrink: 0
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '40px', height: '40px', borderRadius: '10px',
                      background: 'rgba(0,186,124,0.12)', border: '1px solid rgba(0,186,124,0.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#00ba7c', fontSize: '1.1rem', flexShrink: 0
                    }}>
                      <i className="bi bi-file-earmark-spreadsheet-fill"></i>
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '1rem', lineHeight: 1.2, color: 'var(--text-heading, #f0f6fc)' }}>
                        Export Report
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #8b949e)', marginTop: '2px' }}>
                        Choose filters and download attendance data
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowExportModal(false)}
                    style={{
                      width: '30px', height: '30px', borderRadius: '8px',
                      border: '1px solid var(--border-color, rgba(255,255,255,0.1))',
                      background: 'rgba(255,255,255,0.04)', color: 'var(--text-secondary, #8b949e)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', fontSize: '0.8rem', flexShrink: 0
                    }}
                  >
                    <i className="bi bi-x-lg"></i>
                  </button>
                </div>

                {/* ── Body ── */}
                <form onSubmit={handleExportDownload} style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, overflowY: 'auto' }}>
                  <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

                    {/* Time Range */}
                    <div>
                      <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary, #8b949e)', marginBottom: '10px' }}>
                        Time Range
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                        {[
                          { id: 'daily',   label: 'Daily',    icon: 'bi-lightning-charge-fill', color: '#10b981' },
                          { id: 'weekly',  label: 'Weekly',   icon: 'bi-calendar-week',          color: '#3b82f6' },
                          { id: 'monthly', label: 'Monthly',  icon: 'bi-calendar3',              color: '#f59e0b' },
                          { id: 'yearly',  label: 'Yearly',   icon: 'bi-calendar2-check',        color: '#ef4444' },
                          { id: 'all',     label: 'All Time', icon: 'bi-infinity',               color: '#8b5cf6' },
                          { id: 'custom',  label: 'Custom',   icon: 'bi-sliders',                color: '#06b6d4' },
                        ].map(opt => {
                          const sel = exportRange === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => setExportRange(opt.id)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                padding: '8px 6px',
                                borderRadius: '999px',
                                border: sel ? `1.5px solid ${opt.color}` : '1.5px solid var(--border-color, rgba(255,255,255,0.1))',
                                background: sel ? `${opt.color}22` : 'rgba(255,255,255,0.02)',
                                color: sel ? opt.color : 'var(--text-secondary, #8b949e)',
                                fontSize: '0.78rem',
                                fontWeight: sel ? 700 : 500,
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                width: '100%',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <i className={`bi ${opt.icon}`} style={{ fontSize: '0.78rem' }}></i>
                              <span>{opt.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Scope */}
                    <div>
                      <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary, #8b949e)', marginBottom: '10px' }}>
                        Detection Scope
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                        {[
                          { id: 'all',     label: 'All',     icon: 'bi-people-fill',       color: '#00ba7c' },
                          { id: 'known',   label: 'Known',   icon: 'bi-person-check-fill', color: '#3b82f6' },
                          { id: 'unknown', label: 'Unknown', icon: 'bi-person-slash',      color: '#f59e0b' },
                        ].map(opt => {
                          const sel = exportScope === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => setExportScope(opt.id)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                padding: '8px 6px',
                                borderRadius: '999px',
                                border: sel ? `1.5px solid ${opt.color}` : '1.5px solid var(--border-color, rgba(255,255,255,0.1))',
                                background: sel ? `${opt.color}22` : 'rgba(255,255,255,0.02)',
                                color: sel ? opt.color : 'var(--text-secondary, #8b949e)',
                                fontSize: '0.78rem',
                                fontWeight: sel ? 700 : 500,
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                width: '100%',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <i className={`bi ${opt.icon}`} style={{ fontSize: '0.78rem' }}></i>
                              <span>{opt.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Custom Date Range — only show when "custom" is selected */}
                    {exportRange === 'custom' && (
                      <div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary, #8b949e)', marginBottom: '10px' }}>
                          Date Range
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          {[
                            { label: 'From', value: startDate, onChange: e => setStartDate(e.target.value) },
                            { label: 'To',   value: endDate,   onChange: e => setEndDate(e.target.value)   },
                          ].map(f => (
                            <div key={f.label}>
                              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #8b949e)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                                {f.label}
                              </label>
                              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                <i
                                  className="bi bi-calendar3 position-absolute"
                                  style={{
                                    left: '14px',
                                    color: 'var(--color-primary, #3b82f6)',
                                    fontSize: '0.85rem',
                                    pointerEvents: 'none',
                                    zIndex: 2
                                  }}
                                ></i>
                                <input
                                  type="date"
                                  lang="en-GB"
                                  value={f.value}
                                  onChange={f.onChange}
                                  style={{
                                    width: '100%',
                                    height: '42px',
                                    borderRadius: '999px',
                                    border: '1.5px solid var(--border-color, rgba(255,255,255,0.12))',
                                    background: 'var(--bg-input, rgba(255,255,255,0.04))',
                                    color: 'var(--text-heading, #f0f6fc)',
                                    fontSize: '0.85rem',
                                    paddingLeft: '38px',
                                    paddingRight: '14px',
                                    colorScheme: 'dark',
                                    outline: 'none',
                                    cursor: 'pointer'
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>

                  {/* ── Footer ── */}
                  <div style={{
                    padding: '14px 24px 20px',
                    borderTop: '1px solid var(--border-color, rgba(255,255,255,0.07))',
                    display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0
                  }}>
                    <button
                      type="button"
                      onClick={() => setShowExportModal(false)}
                      style={{
                        flex: '0 0 auto',
                        padding: '0 20px',
                        height: '40px',
                        borderRadius: '999px',
                        border: '1.5px solid var(--border-color, rgba(255,255,255,0.12))',
                        background: 'transparent',
                        color: 'var(--text-secondary, #8b949e)',
                        fontSize: '0.83rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn-modal-download"
                      style={{
                        flex: 1,
                        height: '42px',
                        borderRadius: '999px',
                        border: 'none',
                        outline: 'none',
                        color: '#ffffff',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        cursor: 'pointer'
                      }}
                    >
                      <i className="bi bi-download" style={{ color: '#ffffff', fontSize: '0.9rem' }}></i>
                      <span style={{ color: '#ffffff' }}>Generate & Download</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}

      {/* Snapshot Preview Modal */}
      {selectedImage && createPortal(
        <div
          className="modal-backdrop-custom d-flex align-items-center justify-content-center"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0, 0, 0, 0.75)',
            zIndex: 9999,
            padding: '20px'
          }}
          onClick={() => setSelectedImage(null)}
        >
          <div
            className="position-relative bg-dark rounded-4 overflow-hidden shadow-2xl border border-secondary border-opacity-50 animate-scale-up"
            style={{ maxWidth: '600px', width: '100%' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="p-3 d-flex align-items-center justify-content-between border-bottom border-secondary border-opacity-25 bg-dark">
              <span className="fw-bold text-white fs-6 d-flex align-items-center gap-2">
                <i className="bi bi-camera-fill text-primary"></i> Detection Snapshot
              </span>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary rounded-circle border-0 text-white d-flex align-items-center justify-content-center"
                onClick={() => setSelectedImage(null)}
                style={{ width: '32px', height: '32px' }}
              >
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <div className="p-3 text-center bg-black d-flex align-items-center justify-content-center" style={{ minHeight: '260px' }}>
              <img
                src={selectedImage}
                alt="Detection Capture"
                className="img-fluid rounded-3 shadow"
                style={{ maxHeight: '70vh', objectFit: 'contain' }}
              />
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
