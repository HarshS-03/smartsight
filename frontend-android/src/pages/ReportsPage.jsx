import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import API from '../api/axios';
import { Filesystem, Directory } from '@capacitor/filesystem';

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
  const [timeframeQuery, setTimeframeQuery] = useState('week');

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [showPerPageDropdown, setShowPerPageDropdown] = useState(false);
  const [showCameraDropdown, setShowCameraDropdown] = useState(false);
  const [showPersonDropdown, setShowPersonDropdown] = useState(false);
  const [showTimeframeDropdown, setShowTimeframeDropdown] = useState(false);

  const [exportRange, setExportRange] = useState('today');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [activeChart, setActiveChart] = useState('bar');
  const [chartTimeframe, setChartTimeframe] = useState('7D');
  const [chartScope, setChartScope] = useState('ALL');
  const barChartRef = useRef(null);
  const doughnutChartRef = useRef(null);
  const exportBtnRef = useRef(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 });
  const [toastMessage, setToastMessage] = useState(null);

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

      // Check if running in Capacitor WebView
      const isCapacitor = window.Capacitor !== undefined || window.location.protocol === 'capacitor:';

      if (isCapacitor) {
        // Use Capacitor Filesystem to save report to Downloads/smartsight
        const reader = new FileReader();
        reader.onloadend = async () => {
          try {
            let base64Data = reader.result;
            if (base64Data.includes(',')) {
              base64Data = base64Data.split(',')[1];
            }
            const path = `Download/smartsight/${filename}`;
            await Filesystem.writeFile({
              path: path,
              data: base64Data,
              directory: Directory.ExternalStorage,
              recursive: true
            });
            if (window.showToast) {
              window.showToast(`Report saved to Downloads/smartsight/\n${filename}`, 'success', 'SUCCESS');
            } else if (showToast) {
              showToast(`Report saved to Downloads/smartsight/\n${filename}`, 'success');
            }
          } catch (e) {
            console.error('Filesystem error:', e);
            if (window.showToast) {
              window.showToast('Failed to save report. Please check storage permissions.', 'error', 'SYSTEM ALERT');
            } else if (showToast) {
              showToast('Failed to save report. Please check storage permissions.', 'error');
            }
          }
        };
        reader.readAsDataURL(response.data);
      } else {
        // Standard Web Browser Download
        const url = window.URL.createObjectURL(response.data);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        if (window.showToast) {
          window.showToast(`Report downloaded:\n${filename}`, 'success', 'SUCCESS');
        } else if (showToast) {
          showToast(`Report downloaded:\n${filename}`, 'success');
        }
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
          date: dateStr,
          rawTimestamp: dateObj.getTime(),
          camera_name: log.camera_name || "Default Camera",
          person_name: log.person_name || "Unknown Person",
          status: log.status,
          entry_time: timeStr,
          exit_time: timeStr,
          frequency: 1
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
      <section className="reports-hero">
        <div className="reports-hero-bg-wrapper">
          <div className="reports-hero-bg"></div>
          <div className="reports-orb"></div>
        </div>

        <div className="container position-relative" style={{ zIndex: 2 }}>
          <div className="row align-items-center text-center text-md-start">
            <div className="col-md-8 mb-3 mb-md-0">
              <h1 className="reports-title mb-2">
                Recognition <span className="accent">Reports</span>
              </h1>
              <p className="mx-auto ms-md-0" style={{ color: 'var(--text-secondary)', fontSize: '.95rem', maxWidth: '500px' }}>
                Dynamic frequent persons dashboard &amp; attendance analytics.
              </p>
            </div>
            <div className="col-md-4 text-center text-md-end">
              <div className="d-inline-block position-relative" id="exportDropdownContainer">
                <button
                  ref={exportBtnRef}
                  className="btn btn-excel px-4 py-2 rounded-pill d-inline-flex align-items-center justify-content-center gap-2"
                  type="button"
                  id="exportDropdown"
                  onClick={openExportDropdown}
                  aria-expanded={showExportDropdown}>
                  <i className="bi bi-file-earmark-excel-fill fs-5"></i>
                  <span>Export Reports</span>
                  <i className={`bi bi-chevron-down ms-1 ${showExportDropdown ? 'rotate-180' : ''}`} style={{ fontSize: '0.8rem', transition: 'transform 0.25s ease' }}></i>
                </button>

                {showExportDropdown && (
                  <ul
                    className="glass-dropdown-menu shadow-lg text-start"
                    aria-labelledby="exportDropdown"
                    style={{
                      position: 'absolute',
                      top: '100%',
                      right: 0,
                      marginTop: '8px',
                      minWidth: '230px',
                      zIndex: 9999,
                      display: 'block',
                      listStyle: 'none'
                    }}>
                    <li>
                      <a className="dropdown-item py-2 px-3 rounded-3" href="#" onClick={(e) => { e.preventDefault(); handleQuickExport('daily'); }}>
                        <i className="bi bi-calendar-day me-2 text-success"></i> Daily Report
                      </a>
                    </li>
                    <li>
                      <a className="dropdown-item py-2 px-3 rounded-3" href="#" onClick={(e) => { e.preventDefault(); handleQuickExport('weekly'); }}>
                        <i className="bi bi-calendar-week me-2 text-primary"></i> Weekly Report
                      </a>
                    </li>
                    <li>
                      <a className="dropdown-item py-2 px-3 rounded-3" href="#" onClick={(e) => { e.preventDefault(); handleQuickExport('monthly'); }}>
                        <i className="bi bi-calendar-month me-2 text-warning"></i> Monthly Report
                      </a>
                    </li>
                    <li>
                      <a className="dropdown-item py-2 px-3 rounded-3" href="#" onClick={(e) => { e.preventDefault(); handleQuickExport('yearly'); }}>
                        <i className="bi bi-calendar-event me-2 text-danger"></i> Yearly Report
                      </a>
                    </li>
                    <li>
                      <a className="dropdown-item py-2 px-3 rounded-3" href="#" onClick={(e) => { e.preventDefault(); handleQuickExport('all'); }}>
                        <i className="bi bi-archive me-2 text-info"></i> All Records
                      </a>
                    </li>
                    <li><hr className="dropdown-divider opacity-25 my-1" style={{ borderColor: 'var(--border-color)' }} /></li>
                    <li>
                      <a className="dropdown-item py-2 px-3 rounded-3 fw-bold" href="#" onClick={(e) => { e.preventDefault(); setShowExportDropdown(false); setShowExportModal(true); }}>
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
        {/* Quick Stats Cards Section */}
        <div className="row g-3 mb-4">
          {/* Total Detections Card */}
          <div className="col-12 col-md-4" data-reveal="true" data-reveal-delay="0">
            <div className="stat-card stat-card-blue p-4 d-flex align-items-center justify-content-between h-100" style={{ borderRadius: '20px' }}>
              <div className="d-flex align-items-center gap-2">
                <div className="d-flex align-items-center justify-content-center rounded flex-shrink-0" style={{ width: '40px', height: '40px', background: 'rgba(13, 110, 253, 0.1)' }}>
                  <i className="bi bi-cpu" style={{ color: '#0d6efd', fontSize: '1.15rem' }}></i>
                </div>
                <div>
                  <h6 className="mb-0 fw-bold text-dynamic" style={{ fontSize: '0.95rem' }}>Total Detections</h6>
                  <span className="text-secondary d-block" style={{ fontSize: '0.75rem', fontWeight: '600', letterSpacing: '0.5px', textTransform: 'uppercase', lineHeight: 1.2 }}>All Events</span>
                </div>
              </div>
              <div className="rounded-circle d-flex align-items-center justify-content-center text-white shadow font-mono" 
                   style={{ width: '56px', height: '56px', fontSize: '1.4rem', fontWeight: '800', background: '#0d6efd', border: '3px solid rgba(255,255,255,0.1)' }}>
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
                            style={{ fontSize: '0.75rem', background: 'rgba(13, 110, 253, 0.15)', color: '#0d6efd', border: '1px solid rgba(13, 110, 253, 0.3)' }}>
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
                      { id: 'ALL', label: 'All', color: '#0d6efd' },
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
                                        background: '#0d6efd',
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
                          stroke="#0d6efd"
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
                        <div className="rounded-circle bg-primary" style={{ width: '12px', height: '12px', boxShadow: '0 0 8px #0d6efd' }}></div>
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

              {/* Filter Bar Controls (Camera, Person, Timeframe Dropdowns) */}
              <div className="row g-3 align-items-end mb-3">
                {/* Camera Dropdown */}
                <div className="col-lg-3 col-md-3">
                  <label className="form-label text-secondary small fw-bold text-uppercase mb-2">Camera</label>
                  <div className="dropdown position-relative">
                    <button
                      type="button"
                      className="btn w-100 d-flex align-items-center justify-content-between text-dynamic py-2 px-3.5 rounded-pill"
                      style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', fontSize: '0.85rem' }}
                      onClick={() => { setShowCameraDropdown(!showCameraDropdown); setShowPersonDropdown(false); setShowTimeframeDropdown(false); setShowPerPageDropdown(false); }}
                    >
                      <span className="text-truncate">
                        <i className="bi bi-camera-video me-2 text-primary"></i>
                        {cameraQuery === 'all' ? 'All Cameras' : cameraQuery}
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
                            backdropFilter: 'blur(20px)',
                            WebkitBackdropFilter: 'blur(20px)',
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
                <div className="col-lg-3 col-md-3">
                  <label className="form-label text-secondary small fw-bold text-uppercase mb-2">Person</label>
                  <div className="dropdown position-relative">
                    <button
                      type="button"
                      className="btn w-100 d-flex align-items-center justify-content-between text-dynamic py-2 px-3.5 rounded-pill"
                      style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', fontSize: '0.85rem' }}
                      onClick={() => { setShowPersonDropdown(!showPersonDropdown); setShowCameraDropdown(false); setShowTimeframeDropdown(false); setShowPerPageDropdown(false); }}
                    >
                      <span className="text-truncate">
                        <i className="bi bi-person me-2 text-primary"></i>
                        {statusQuery === 'KNOWN' ? 'Known Persons' : statusQuery === 'UNKNOWN' ? 'Unknown Persons' : 'All Persons'}
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
                            backdropFilter: 'blur(20px)',
                            WebkitBackdropFilter: 'blur(20px)',
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

                {/* Timeframe Dropdown (Default Weekly & Dynamic Years) */}
                <div className="col-lg-4 col-md-3">
                  <label className="form-label text-secondary small fw-bold text-uppercase mb-2">Timeframe</label>
                  <div className="dropdown position-relative">
                    <button
                      type="button"
                      className="btn w-100 d-flex align-items-center justify-content-between text-dynamic py-2 px-3.5 rounded-pill"
                      style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', fontSize: '0.85rem' }}
                      onClick={() => { setShowTimeframeDropdown(!showTimeframeDropdown); setShowCameraDropdown(false); setShowPersonDropdown(false); setShowPerPageDropdown(false); }}
                    >
                      <span className="text-truncate">
                        <i className="bi bi-calendar3 me-2 text-primary"></i>
                        {timeframeQuery === 'week' ? 'Weekly (Last 7 Days)' : timeframeQuery === 'month' ? 'Monthly (This Month)' : timeframeQuery === 'year' ? 'Yearly (This Year)' : timeframeQuery === 'today' ? 'Today' : timeframeQuery.startsWith('year-') ? `Year ${timeframeQuery.split('-')[1]}` : 'All Time'}
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
                            backdropFilter: 'blur(20px)',
                            WebkitBackdropFilter: 'blur(20px)',
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
                <div className="col-lg-2 col-md-3 d-flex align-items-center gap-2">
                  <button
                    type="button"
                    className="btn btn-primary rounded-pill py-2 px-3 flex-grow-1 fw-bold text-nowrap d-flex align-items-center justify-content-center gap-1.5 shadow-primary"
                    style={{ fontSize: '0.85rem' }}
                    onClick={() => setCurrentPage(1)}
                  >
                    <i className="bi bi-funnel-fill"></i>
                    <span>Apply</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-secondary rounded-circle d-flex align-items-center justify-content-center flex-shrink-0 transition-all hover-glow"
                    style={{ width: '38px', height: '38px', border: '1px solid var(--border-input)', background: 'var(--bg-input)' }}
                    title="Reset All Filters"
                    onClick={() => { setSearchQuery(''); setCameraQuery('all'); setStatusQuery('all'); setTimeframeQuery('week'); setCurrentPage(1); }}
                  >
                    <i className="bi bi-arrow-counterclockwise text-secondary fs-6"></i>
                  </button>
                </div>
              </div>
              <div className="table-responsive">
                <table className="table custom-table table-hover align-middle mb-0" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th scope="col" style={{ width: '12%' }}>Date</th>
                      <th scope="col" style={{ width: '16%' }}>Camera</th>
                      <th scope="col" style={{ width: '18%' }}>Person Name</th>
                      <th scope="col" style={{ width: '12%' }} className="text-center">Classification</th>
                      <th scope="col" style={{ width: '15%' }} className="text-center">Entry Time (First Seen)</th>
                      <th scope="col" style={{ width: '15%' }} className="text-center">Exit Time (Last Seen)</th>
                      <th scope="col" style={{ width: '12%' }} className="text-center">Detections (Freq)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentReports.length > 0 ? currentReports.map((rep, index) => (
                      <tr key={index}>
                        <td className="text-secondary fw-semibold">
                          <i className="bi bi-calendar3 me-2 text-primary"></i>
                          {rep.date}
                        </td>
                        <td className="text-secondary fw-semibold">
                          <i className="bi bi-camera-video me-2 text-primary"></i>
                          <span className="ms-1">{rep.camera_name || "Default Camera"}</span>
                        </td>
                        <td>
                          <div className="d-flex align-items-center gap-3">
                            <div className="bg-primary bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center"
                              style={{ width: '36px', height: '36px', border: '1px solid rgba(13, 110, 253, 0.2)' }}>
                              {rep.status === 'KNOWN' ? (
                                <i className="bi bi-person-fill text-primary"></i>
                              ) : (
                                <i className="bi bi-person-fill-exclamation text-danger"></i>
                              )}
                            </div>
                            <span className={`fw-bold ${rep.status === 'KNOWN' ? 'text-dynamic' : 'text-danger opacity-75'}`}>
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
                          <span className="badge rounded-pill bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-3 py-1.5 font-mono d-inline-flex align-items-center gap-2" style={{ fontSize: '0.85rem' }}>
                            <i className="bi bi-box-arrow-in-right fs-6"></i>
                            <span>{rep.entry_time}</span>
                          </span>
                        </td>
                        <td className="text-center">
                          <span className="badge rounded-pill bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 px-3 py-1.5 font-mono d-inline-flex align-items-center gap-2" style={{ fontSize: '0.85rem' }}>
                            <i className="bi bi-box-arrow-left fs-6"></i>
                            <span>{rep.exit_time}</span>
                          </span>
                        </td>
                        <td className="text-center">
                          <span className="badge rounded-pill px-3 py-2 fw-bold fs-6" style={{ background: 'rgba(13, 110, 253, 0.15)', color: '#0d6efd', border: '1px solid rgba(13, 110, 253, 0.3)' }}>
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
                            backdropFilter: 'blur(16px)',
                            WebkitBackdropFilter: 'blur(16px)',
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
                                backdropFilter: 'blur(20px)',
                                WebkitBackdropFilter: 'blur(20px)'
                              }}
                            >
                              {[5, 10, 20, 50].map((num) => (
                                <button
                                  key={num}
                                  type="button"
                                  className="w-100 btn btn-sm text-start rounded-3 px-3 py-1.5 my-0.5 d-flex align-items-center justify-content-between transition-all"
                                  style={{
                                    fontSize: '0.8rem',
                                    background: itemsPerPage === num ? '#0d6efd' : 'transparent',
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
                                  background: currentPage === page ? '#0d6efd' : 'var(--bg-input)',
                                  borderColor: currentPage === page ? '#0d6efd' : 'var(--border-subtle)',
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
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
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
              style={{
                maxWidth: '460px',
                pointerEvents: 'auto'
              }}
            >
              <div
                className="modal-content export-modal-card overflow-hidden shadow-2xl"
                style={{
                  maxHeight: '90vh',
                  background: 'var(--bg-surface-solid, #ffffff)',
                  color: 'var(--text-heading, #0f172a)',
                  borderRadius: '24px',
                  border: '1px solid var(--border-color, rgba(13, 110, 253, 0.15))',
                  boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.3)'
                }}
              >
                {/* Header Bar */}
                <div
                  className="modal-header border-bottom border-secondary border-opacity-10 pb-3.5 pt-4 px-4 d-flex justify-content-between align-items-center"
                >
                  <div className="d-flex align-items-center gap-3">
                    <span
                      className="d-inline-flex align-items-center justify-content-center rounded-4 flex-shrink-0 shadow-sm"
                      style={{
                        background: 'linear-gradient(135deg, rgba(13, 110, 253, 0.15) 0%, rgba(13, 202, 240, 0.15) 100%)',
                        color: '#0d6efd',
                        width: '42px',
                        height: '42px',
                        border: '1px solid rgba(13, 110, 253, 0.2)'
                      }}
                    >
                      <i className="bi bi-file-earmark-excel-fill fs-5" style={{ color: '#0d6efd' }}></i>
                    </span>
                    <div>
                      <h5 className="modal-title fw-extrabold text-dynamic mb-0" style={{ fontSize: '1.05rem', letterSpacing: '-0.2px' }}>
                        Export Configuration
                      </h5>
                      <p className="text-secondary small mb-0 mt-0.5" style={{ fontSize: '0.78rem' }}>
                        Select timeframe &amp; event scope criteria
                      </p>
                    </div>
                  </div>

                  {/* Close Button */}
                  <button
                    type="button"
                    className="btn btn-sm d-flex align-items-center justify-content-center flex-shrink-0 transition-all text-dynamic"
                    onClick={() => setShowExportModal(false)}
                    aria-label="Close"
                    style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '50%',
                      background: 'var(--bg-input, rgba(0, 0, 0, 0.06))',
                      border: '1px solid var(--border-color, rgba(0, 0, 0, 0.1))',
                      padding: 0
                    }}
                  >
                    <i className="bi bi-x-lg" style={{ fontSize: '0.85rem' }}></i>
                  </button>
                </div>

                {/* Body Form */}
                <form onSubmit={handleExportDownload} className="d-flex flex-column" style={{ overflowY: 'auto' }}>
                  <div className="modal-body p-4 pb-4">

                    {/* Time Horizon Selection (Single Balanced Row / Responsive Grid) */}
                    <div style={{ marginBottom: '1.5rem' }}>
                      <label
                        className="form-label text-secondary small fw-bold text-uppercase mb-2.5 d-flex align-items-center gap-2"
                        style={{ letterSpacing: '0.7px', fontSize: '0.725rem' }}
                      >
                        <i className="bi bi-clock-history text-primary fs-6"></i> Report Time Horizon
                      </label>

                      <div className="d-flex flex-wrap gap-2 w-100 justify-content-between">
                        {[
                          {
                            id: 'daily',
                            label: 'Daily',
                            icon: 'bi-lightning-charge-fill',
                            color: '#f59e0b',
                            gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                            shadow: '0 6px 18px rgba(245, 158, 11, 0.4)',
                            softBg: 'rgba(245, 158, 11, 0.12)'
                          },
                          {
                            id: 'weekly',
                            label: 'Weekly',
                            icon: 'bi-calendar-week-fill',
                            color: '#3b82f6',
                            gradient: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                            shadow: '0 6px 18px rgba(59, 130, 246, 0.4)',
                            softBg: 'rgba(59, 130, 246, 0.12)'
                          },
                          {
                            id: 'monthly',
                            label: 'Monthly',
                            icon: 'bi-calendar-month-fill',
                            color: '#a855f7',
                            gradient: 'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)',
                            shadow: '0 6px 18px rgba(168, 85, 247, 0.4)',
                            softBg: 'rgba(168, 85, 247, 0.12)'
                          },
                          {
                            id: 'yearly',
                            label: 'Yearly',
                            icon: 'bi-calendar2-event-fill',
                            color: '#10b981',
                            gradient: 'linear-gradient(135deg, #10b981 0%, #047857 100%)',
                            shadow: '0 6px 18px rgba(16, 185, 129, 0.4)',
                            softBg: 'rgba(16, 185, 129, 0.12)'
                          },
                          {
                            id: 'all',
                            label: 'All Records',
                            icon: 'bi-archive-fill',
                            color: '#06b6d4',
                            gradient: 'linear-gradient(135deg, #06b6d4 0%, #0e7490 100%)',
                            shadow: '0 6px 18px rgba(6, 182, 212, 0.4)',
                            softBg: 'rgba(6, 182, 212, 0.12)'
                          }
                        ].map((rangeOpt) => {
                          const isSelected = exportRange === rangeOpt.id;
                          return (
                            <button
                              key={rangeOpt.id}
                              type="button"
                              onClick={() => setExportRange(rangeOpt.id)}
                              className="btn py-2 px-2.5 rounded-pill d-flex align-items-center justify-content-center transition-all text-nowrap flex-fill"
                              style={{
                                fontSize: '0.8rem',
                                fontWeight: isSelected ? 700 : 600,
                                minWidth: '72px',
                                background: isSelected
                                  ? rangeOpt.gradient
                                  : 'var(--bg-input, rgba(0, 0, 0, 0.03))',
                                border: isSelected
                                  ? '1px solid rgba(255, 255, 255, 0.3)'
                                  : `1px solid ${rangeOpt.color}35`,
                                color: isSelected ? '#ffffff' : 'var(--text-heading, #0f172a)',
                                boxShadow: isSelected ? rangeOpt.shadow : 'none',
                                transform: isSelected ? 'translateY(-1px)' : 'none'
                              }}
                            >
                              <span className="d-inline-flex align-items-center justify-content-center gap-1.5">
                                <span
                                  className="d-inline-flex align-items-center justify-content-center rounded-circle flex-shrink-0"
                                  style={{
                                    width: '22px',
                                    height: '22px',
                                    background: isSelected ? 'rgba(255, 255, 255, 0.22)' : rangeOpt.softBg,
                                    color: isSelected ? '#ffffff' : rangeOpt.color
                                  }}
                                >
                                  <i className={`bi ${rangeOpt.icon}`} style={{ fontSize: '0.75rem' }}></i>
                                </span>
                                <span>{rangeOpt.label}</span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Custom Date Range Selection */}
                    <div style={{ marginBottom: '1.5rem' }}>
                      <label
                        className="form-label text-secondary small fw-bold text-uppercase mb-2 d-flex align-items-center gap-2"
                        style={{ letterSpacing: '0.7px', fontSize: '0.725rem' }}
                      >
                        <i className="bi bi-calendar-range text-primary fs-6"></i> Custom Date Filter <span className="fw-normal text-muted opacity-75">(Optional)</span>
                      </label>

                      <div className="custom-date-grid">
                        <div>
                          <label className="small text-secondary fw-semibold d-block mb-1" style={{ fontSize: '0.78rem' }}>Start Date</label>
                          <input
                            type="date"
                            lang="en-GB"
                            className="form-control text-dynamic py-2.5 px-3 rounded-3 font-mono w-100"
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                            style={{
                              background: 'var(--bg-input, rgba(0,0,0,0.04))',
                              border: '1px solid var(--border-color, rgba(0,0,0,0.12))',
                              color: 'var(--text-heading, #0f172a)',
                              fontSize: '0.85rem'
                            }}
                          />
                        </div>
                        <div>
                          <label className="small text-secondary fw-semibold d-block mb-1" style={{ fontSize: '0.78rem' }}>End Date</label>
                          <input
                            type="date"
                            lang="en-GB"
                            className="form-control text-dynamic py-2.5 px-3 rounded-3 font-mono w-100"
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                            style={{
                              background: 'var(--bg-input, rgba(0,0,0,0.04))',
                              border: '1px solid var(--border-color, rgba(0,0,0,0.12))',
                              color: 'var(--text-heading, #0f172a)',
                              fontSize: '0.85rem'
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Detection Type Filter */}
                    <div style={{ marginBottom: '1.5rem' }}>
                      <label
                        className="form-label text-secondary small fw-bold text-uppercase mb-2 d-flex align-items-center gap-2"
                        style={{ letterSpacing: '0.7px', fontSize: '0.725rem' }}
                      >
                        <i className="bi bi-funnel text-primary fs-6"></i> Detection Event Scope
                      </label>

                      <div className="d-flex flex-column gap-2">
                        {[
                          { id: 'all', label: 'All Detections (Known + Unknown)', icon: 'bi-people-fill', color: '#0d6efd', activeBg: 'rgba(13, 110, 253, 0.08)' },
                          { id: 'known', label: 'Known Personnel Only', icon: 'bi-person-check-fill', color: '#10b981', activeBg: 'rgba(16, 185, 129, 0.08)' },
                          { id: 'unknown', label: 'Unknown Intrusions Only', icon: 'bi-person-exclamation', color: '#ef4444', activeBg: 'rgba(239, 68, 68, 0.08)' }
                        ].map((filterOpt) => {
                          const isSelected = exportScope === filterOpt.id;
                          return (
                            <div
                              key={filterOpt.id}
                              onClick={() => setExportScope(filterOpt.id)}
                              className="p-2.5 px-3 rounded-4 d-flex align-items-center justify-content-between transition-all"
                              style={{
                                background: isSelected ? filterOpt.activeBg : 'var(--bg-input, rgba(0, 0, 0, 0.03))',
                                border: isSelected ? `1.5px solid ${filterOpt.color}` : '1px solid var(--border-color, rgba(0, 0, 0, 0.08))',
                                cursor: 'pointer',
                                boxShadow: isSelected ? `0 4px 14px ${filterOpt.color}15` : 'none'
                              }}
                            >
                              <div className="d-flex align-items-center" style={{ gap: '14px' }}>
                                <span
                                  className="d-inline-flex align-items-center justify-content-center rounded-circle flex-shrink-0"
                                  style={{
                                    width: '32px',
                                    height: '32px',
                                    background: `${filterOpt.color}15`,
                                    color: filterOpt.color
                                  }}
                                >
                                  <i className={`bi ${filterOpt.icon} fs-6`}></i>
                                </span>
                                <span className="fw-bold text-dynamic" style={{ fontSize: '0.84rem' }}>{filterOpt.label}</span>
                              </div>
                              {isSelected ? (
                                <span
                                  className="badge rounded-circle p-1 d-flex align-items-center justify-content-center text-white shadow-sm"
                                  style={{ width: '20px', height: '20px', background: filterOpt.color }}
                                >
                                  <i className="bi bi-check2" style={{ fontSize: '0.75rem' }}></i>
                                </span>
                              ) : (
                                <span className="rounded-circle border border-secondary border-opacity-40" style={{ width: '18px', height: '18px' }}></span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Master Green Download CTA Button */}
                    <div style={{ marginTop: '1.25rem', marginBottom: '0' }}>
                      <button
                        type="submit"
                        className="btn w-100 rounded-pill fw-bold py-2.5 px-3 text-white d-flex align-items-center justify-content-center gap-2 transition-all shadow-lg hover-glow"
                        style={{
                          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                          border: '1px solid rgba(255, 255, 255, 0.3)',
                          boxShadow: '0 8px 25px -4px rgba(16, 185, 129, 0.45)',
                          fontSize: '0.85rem'
                        }}
                      >
                        <i className="bi bi-file-earmark-arrow-down-fill fs-5 flex-shrink-0"></i>
                        <span className="fw-bold text-nowrap">Generate &amp; Download Excel Report</span>
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
}
