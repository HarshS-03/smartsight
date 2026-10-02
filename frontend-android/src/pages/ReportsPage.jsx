import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import API from '../api/axios';
import getImageUrl from '../utils/imageUrl';

const QUICK_EXPORT_RANGES = [
  { id: 'daily', label: 'Daily Report', icon: 'bi-calendar-day', color: 'text-success' },
  { id: 'weekly', label: 'Weekly Report', icon: 'bi-calendar-week', color: 'text-primary' },
  { id: 'monthly', label: 'Monthly Report', icon: 'bi-calendar-month', color: 'text-warning' },
  { id: 'yearly', label: 'Yearly Report', icon: 'bi-calendar-event', color: 'text-danger' },
  { id: 'all', label: 'All Records', icon: 'bi-archive', color: 'text-info' },
];

export default function ReportsPage() {
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportScope, setExportScope] = useState('all'); // 'all', 'known', 'unknown'
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [totalDetections, setTotalDetections] = useState(0);
  const [knownDetections, setKnownDetections] = useState(0);
  const [unknownDetections, setUnknownDetections] = useState(0);

  const [frequentPersons, setFrequentPersons] = useState([]);
  const [frequentPersonsFilter, setFrequentPersonsFilter] = useState('ALL');
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
  const [exportFormat, setExportFormat] = useState('excel'); // 'excel' or 'pdf'
  const [showPdfDropdown, setShowPdfDropdown] = useState(false);
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

  // ── Download Report (Excel or PDF with Photos) ──
  const handleBackendExport = async (params = {}) => {
    try {
      setShowExportDropdown(false);
      setShowExportModal(false);

      const isPdf = params.export_format === 'pdf';
      const response = await API.get('/reports/export/', {
        params,
        responseType: 'blob',
      });

      let ext = isPdf ? 'pdf' : 'xlsx';
      let filename = `SmartSight_${params.time_range || 'Export'}_Report.${ext}`;
      const contentDisposition = response.headers && response.headers['content-disposition'];
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) filename = match[1];
      }

      // Check if running on native Capacitor Android platform
      const isNative = Capacitor.isNativePlatform();

      if (isNative) {
        // Use Capacitor Filesystem to save report
        const reader = new FileReader();
        reader.onloadend = async () => {
          try {
            let base64Data = reader.result;
            if (typeof base64Data === 'string' && base64Data.includes(',')) {
              base64Data = base64Data.split(',')[1];
            }

            // Check / request storage permissions gracefully if supported
            try {
              if (Filesystem.checkPermissions && Filesystem.requestPermissions) {
                const perm = await Filesystem.checkPermissions();
                if (perm?.publicStorage !== 'granted') {
                  await Filesystem.requestPermissions();
                }
              }
            } catch (permErr) {
              console.warn('Storage permission request info:', permErr);
            }

            // Try saving to Documents directory first (accessible on Android 10+)
            let savedLocation = 'Documents/SmartSight';
            try {
              await Filesystem.writeFile({
                path: `SmartSight/${filename}`,
                data: base64Data,
                directory: Directory.Documents,
                recursive: true
              });
            } catch (docErr) {
              console.warn('Writing to Documents folder failed, writing to Cache storage:', docErr);
              await Filesystem.writeFile({
                path: filename,
                data: base64Data,
                directory: Directory.Cache,
                recursive: true
              });
              savedLocation = 'App Storage';
            }

            const docType = isPdf ? 'PDF Report (with photos)' : 'Excel Report';
            if (window.showToast) {
              window.showToast(`${docType} saved to ${savedLocation}:\n${filename}`, 'success', 'SUCCESS');
            } else if (showToast) {
              showToast(`${docType} saved to ${savedLocation}:\n${filename}`, 'success');
            }
          } catch (e) {
            console.error('Filesystem save error, falling back to browser download:', e);
            // Fallback to standard blob download in webview
            try {
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
            } catch (fallbackErr) {
              if (window.showToast) {
                window.showToast('Failed to save report. Please check storage permissions.', 'error', 'SYSTEM ALERT');
              } else if (showToast) {
                showToast('Failed to save report. Please check storage permissions.', 'error');
              }
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
        const docType = isPdf ? 'PDF Report' : 'Excel Report';
        if (window.showToast) {
          window.showToast(`${docType} downloaded:\n${filename}`, 'success', 'SUCCESS');
        } else if (showToast) {
          showToast(`${docType} downloaded:\n${filename}`, 'success');
        }
      }
    } catch (err) {
      console.error('Error downloading report:', err);
      if (window.showToast) {
        window.showToast('Could not download report file. Please verify server connection.', 'error', 'SYSTEM ALERT');
      } else if (showToast) {
        showToast('Could not download report file. Please verify server connection.', 'error');
      }
    }
  };

  const handleQuickExport = (range, format = 'excel') => {
    handleBackendExport({ time_range: range, export_format: format });
  };


  const handleExportDownload = (e) => {
    e.preventDefault();
    const params = { time_range: exportRange, status_scope: exportScope, export_format: exportFormat };
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
          camera_name: (log.camera_name || "Default Camera").replace(/Biometric/gi, "Access"),
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

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const thisWeekStart = new Date(today);
      thisWeekStart.setDate(today.getDate() - today.getDay());
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const personCounts = {};
      logs.forEach(log => {
        // If UNKNOWN, treat each detection as a unique occurrence since we don't have facial grouping
        const isUnknown = log.status === 'UNKNOWN';
        const name = isUnknown ? `Unknown Person #${log.id || Math.floor(Math.random()*1000)}` : (log.person_name || 'Unknown Person');
        
        if (!personCounts[name]) {
          personCounts[name] = { total_count: 0, daily_count: 0, weekly_count: 0, monthly_count: 0, last_seen: log.timestamp, status: log.status, image_path: log.image_path, is_unknown: isUnknown };
        }
        
        const logDate = new Date(log.timestamp);
        const logDay = new Date(logDate.getFullYear(), logDate.getMonth(), logDate.getDate());

        personCounts[name].total_count += 1;
        
        if (logDay.getTime() === today.getTime()) {
          personCounts[name].daily_count += 1;
        }
        if (logDate >= thisWeekStart) {
          personCounts[name].weekly_count += 1;
        }
        if (logDate >= thisMonthStart) {
          personCounts[name].monthly_count += 1;
        }

        if (logDate > new Date(personCounts[name].last_seen)) {
          personCounts[name].last_seen = log.timestamp;
          if (log.image_path) personCounts[name].image_path = log.image_path;
        } else if (!personCounts[name].image_path && log.image_path) {
          personCounts[name].image_path = log.image_path;
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
          total_count: data.total_count,
          daily_count: data.daily_count,
          weekly_count: data.weekly_count,
          monthly_count: data.monthly_count,
          last_seen: `${dateStr}, ${timeStr}`,
          imageUrl: data.image_path ? getImageUrl(data.image_path) : null
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
      if (!event.target.closest('#exportDropdownContainer') && !event.target.closest('#pdfDropdownContainer')) {
        setShowExportDropdown(false);
        setShowPdfDropdown(false);
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
          <div className="row align-items-center gy-3">
            <div className="col-12 col-lg-6 text-center text-lg-start">
              <h1 className="reports-title mb-2">
                Recognition <span className="accent">Reports</span>
              </h1>
              <p className="page-hero-sub text-center text-lg-start mb-0">
                Dynamic frequent persons dashboard &amp; access control analytics.
              </p>
            </div>
            <div className="col-12 col-lg-6 text-center text-lg-end d-flex align-items-center justify-content-center justify-content-lg-end gap-2 flex-wrap">
                {/* Red PDF Export Dropdown Button */}
                <div className="d-inline-block position-relative" id="pdfDropdownContainer" style={{ zIndex: 1052 }}>
                  <button
                    className="btn btn-danger px-3.5 py-2 rounded-pill d-inline-flex align-items-center justify-content-center gap-2 shadow-sm"
                    type="button"
                    onClick={() => {
                      setShowPdfDropdown(!showPdfDropdown);
                      setShowExportDropdown(false);
                    }}
                    title="Export PDF Reports"
                    style={{ background: '#dc3545', border: 'none' }}
                    aria-expanded={showPdfDropdown}
                  >
                    <i className="bi bi-file-earmark-pdf-fill fs-5" style={{ color: '#ffffff' }}></i>
                    <span style={{ color: '#ffffff', fontWeight: 700, fontSize: '0.85rem' }}>PDF Reports</span>
                    <i className={`bi bi-chevron-down ms-1 ${showPdfDropdown ? 'rotate-180' : ''}`} style={{ fontSize: '0.8rem', transition: 'transform 0.25s ease', color: '#ffffff' }}></i>
                  </button>

                  {showPdfDropdown && (
                    <ul className="glass-dropdown-menu export-dropdown-menu shadow-lg text-start" style={{ left: 0, right: 'auto' }}>
                      {QUICK_EXPORT_RANGES.map(opt => (
                        <li key={opt.id}>
                          <button
                            type="button"
                            className={`dropdown-item export-item-${opt.id} py-2 px-3 rounded-3 d-flex align-items-center w-100 text-start border-0 bg-transparent`}
                            onClick={(e) => {
                              e.preventDefault();
                              setShowPdfDropdown(false);
                              handleQuickExport(opt.id, 'pdf');
                            }}
                          >
                            <i className={`bi ${opt.icon} me-2 ${opt.color}`}></i>
                            <span>{opt.label}</span>
                          </button>
                        </li>
                      ))}
                      <li><hr className="dropdown-divider opacity-25 my-1" style={{ borderColor: 'var(--border-color)' }} /></li>
                      <li>
                        <button
                          type="button"
                          className="dropdown-item export-item-custom py-2 px-3 rounded-3 fw-bold d-flex align-items-center w-100 text-start border-0 bg-transparent"
                          onClick={(e) => {
                            e.preventDefault();
                            setShowPdfDropdown(false);
                            setExportFormat('pdf');
                            setShowExportModal(true);
                          }}
                        >
                          <i className="bi bi-sliders me-2 text-warning"></i>
                          <span>Custom...</span>
                        </button>
                      </li>
                    </ul>
                  )}
                </div>

                {/* Green Excel Export Dropdown Button */}
                <div className="d-inline-block position-relative" id="exportDropdownContainer" style={{ zIndex: 1051 }}>
                  <button
                    className="btn btn-success px-3.5 py-2 rounded-pill d-inline-flex align-items-center justify-content-center gap-2 shadow-sm"
                    type="button"
                    onClick={() => {
                      setShowExportDropdown(!showExportDropdown);
                      setShowPdfDropdown(false);
                    }}
                    title="Export Excel Reports"
                    style={{ background: '#198754', border: 'none' }}
                    aria-expanded={showExportDropdown}
                  >
                    <i className="bi bi-file-earmark-excel-fill fs-5" style={{ color: '#ffffff' }}></i>
                    <span style={{ color: '#ffffff', fontWeight: 700, fontSize: '0.85rem' }}>Excel Reports</span>
                    <i className={`bi bi-chevron-down ms-1 ${showExportDropdown ? 'rotate-180' : ''}`} style={{ fontSize: '0.8rem', transition: 'transform 0.25s ease', color: '#ffffff' }}></i>
                  </button>

                  {showExportDropdown && (
                    <ul className="glass-dropdown-menu export-dropdown-menu shadow-lg text-start" style={{ right: 0, left: 'auto' }}>
                      {QUICK_EXPORT_RANGES.map(opt => (
                        <li key={opt.id}>
                          <button
                            type="button"
                            className={`dropdown-item export-item-${opt.id} py-2 px-3 rounded-3 d-flex align-items-center w-100 text-start border-0 bg-transparent`}
                            onClick={(e) => {
                              e.preventDefault();
                              setShowExportDropdown(false);
                              handleQuickExport(opt.id, 'excel');
                            }}
                          >
                            <i className={`bi ${opt.icon} me-2 ${opt.color}`}></i>
                            <span>{opt.label}</span>
                          </button>
                        </li>
                      ))}
                      <li><hr className="dropdown-divider opacity-25 my-1" style={{ borderColor: 'var(--border-color)' }} /></li>
                      <li>
                        <button
                          type="button"
                          className="dropdown-item export-item-custom py-2 px-3 rounded-3 fw-bold d-flex align-items-center w-100 text-start border-0 bg-transparent"
                          onClick={(e) => {
                            e.preventDefault();
                            setShowExportDropdown(false);
                            setExportFormat('excel');
                            setShowExportModal(true);
                          }}
                        >
                          <i className="bi bi-sliders me-2 text-warning"></i>
                          <span>Custom...</span>
                        </button>
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

        {/* Frequent Persons Section */}
        <div className="row mb-4" data-reveal="true" data-reveal-delay="100">
          <div className="col-12">
            <div className="p-3 glass-card rounded-4">
              <h6 className="text-dynamic fw-bold mb-3 d-flex align-items-center gap-2" style={{ fontSize: '1rem' }}>
                <i className="bi bi-bar-chart-steps text-primary"></i>
                <span>Frequency</span>
                {frequentPersons.length > 0 && (
                  <span className="badge rounded-pill bg-primary bg-opacity-10 text-primary fw-bold ms-auto" style={{ fontSize: '0.68rem' }}>
                    {frequentPersons.length}
                  </span>
                )}
              </h6>

              <div className="d-flex align-items-center gap-2 mb-3 bg-inner-card p-1 rounded-pill w-100" style={{ maxWidth: '100%', overflowX: 'auto' }}>
                {['ALL', 'KNOWN', 'UNKNOWN'].map(filter => (
                  <button
                    key={filter}
                    className={`btn btn-sm rounded-pill flex-grow-1 fw-semibold transition-all border-0 ${frequentPersonsFilter === filter ? (filter === 'KNOWN' ? 'bg-success text-white' : filter === 'UNKNOWN' ? 'bg-danger text-white' : 'bg-primary text-white shadow-sm') : 'text-secondary'}`}
                    style={{ fontSize: '0.75rem', padding: '0.4rem 0.5rem' }}
                    onClick={() => setFrequentPersonsFilter(filter)}
                  >
                    {filter === 'ALL' ? 'All' : filter === 'KNOWN' ? 'Known' : 'Unknown'}
                  </button>
                ))}
              </div>

              <div 
                className="custom-scrollbar pe-1" 
                style={{ maxHeight: '380px', overflowY: 'auto' }}
              >
                <div className="d-flex flex-column gap-3">
                  {frequentPersons.length > 0 ? (
                    (() => {
                      const visiblePersons = frequentPersons.filter(p => frequentPersonsFilter === 'ALL' || p.status === frequentPersonsFilter);
                      if (visiblePersons.length === 0) {
                        return (
                          <div className="text-center py-4 text-secondary">
                            <span className="fw-semibold small">No {frequentPersonsFilter.toLowerCase()} persons found.</span>
                          </div>
                        );
                      }
                      return visiblePersons.map((person, index) => (
                        <div
                          key={index}
                          className="d-flex align-items-center gap-3 p-3 rounded-4 shadow-sm cursor-pointer hover-bg-subtle"
                          style={{
                            background: 'rgba(255, 255, 255, 0.03)',
                            border: `1px solid ${person.status === 'KNOWN' ? 'rgba(25, 135, 84, 0.25)' : 'rgba(220, 53, 69, 0.25)'}`,
                            borderLeft: `4px solid ${person.status === 'KNOWN' ? '#198754' : '#dc3545'}`,
                            transition: 'all 0.2s ease',
                          }}
                          onClick={() => {
                            if (person.imageUrl) setSelectedImage(person.imageUrl);
                          }}
                        >
                          {/* Avatar / Icon */}
                          {person.imageUrl ? (
                            <div className="position-relative flex-shrink-0" style={{ width: '46px', height: '46px' }}>
                              <img 
                                src={person.imageUrl} 
                                alt={person.name} 
                                className="rounded-circle w-100 h-100 object-fit-cover shadow-sm"
                                style={{ border: `1.5px solid ${person.status === 'KNOWN' ? '#198754' : '#dc3545'}` }}
                              />
                              <span 
                                className="position-absolute bottom-0 end-0 rounded-circle border border-white"
                                style={{
                                  width: '12px', height: '12px',
                                  background: person.status === 'KNOWN' ? '#198754' : '#dc3545',
                                  transform: 'translate(25%, 25%)'
                                }}
                              ></span>
                            </div>
                          ) : (
                            <div
                              className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                              style={{
                                width: '46px',
                                height: '46px',
                                background: person.status === 'KNOWN' ? 'rgba(25, 135, 84, 0.15)' : 'rgba(220, 53, 69, 0.15)',
                              }}
                            >
                              <i
                                className={`bi ${person.status === 'KNOWN' ? 'bi-person-check-fill' : 'bi-person-fill-exclamation'}`}
                                style={{ color: person.status === 'KNOWN' ? '#198754' : '#dc3545', fontSize: '1.25rem' }}
                              ></i>
                            </div>
                          )}

                      {/* Info */}
                      <div className="flex-grow-1 min-w-0">
                        <div className="d-flex align-items-center gap-2 mb-1">
                          <strong className="text-dynamic text-truncate" style={{ fontSize: '1rem' }}>{person.name}</strong>
                          <span
                            className={`badge rounded-pill fw-bold ${person.status === 'KNOWN' ? 'bg-success' : 'bg-danger'} text-white`}
                            style={{ fontSize: '0.65rem', padding: '0.35em 0.65em' }}
                          >
                            {person.status}
                          </span>
                        </div>
                        
                        <div className="d-flex flex-wrap align-items-center gap-3 text-secondary mb-1" style={{ fontSize: '0.8rem' }}>
                          <span className="d-inline-flex align-items-center gap-1" title="Today">
                            <i className="bi bi-calendar-event text-muted"></i>
                            <span>Today:</span>
                            <strong className="text-dynamic">{person.daily_count}</strong>
                          </span>
                          <span className="d-inline-flex align-items-center gap-1" title="This Week">
                            <i className="bi bi-calendar-week text-muted"></i>
                            <span>Week:</span>
                            <strong className="text-dynamic">{person.weekly_count}</strong>
                          </span>
                          <span className="d-inline-flex align-items-center gap-1" title="This Month">
                            <i className="bi bi-calendar-month text-muted"></i>
                            <span>Month:</span>
                            <strong className="text-dynamic">{person.monthly_count}</strong>
                          </span>
                        </div>
                        
                        <div className="text-secondary opacity-75" style={{ fontSize: '0.75rem' }}>
                          <i className="bi bi-clock-history me-1 text-primary"></i>
                          <span>Last Seen:</span> <strong className="text-dynamic font-mono">{person.last_seen}</strong>
                        </div>
                      </div>
                    </div>
                  ));
                })()
              ) : (
                <div className="text-center py-4 text-secondary">
                    <i className="bi bi-person-x display-6 text-muted mb-2 d-block"></i>
                    <span className="fw-semibold small">No active personnel logs registered yet.</span>
                  </div>
                )}
                </div>
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
                                {/* Known Bar (Green) */}
                                {showKnown && (
                                  <div className="d-flex flex-column align-items-center">
                                    <span className="small font-mono fw-bold text-success mb-1" style={{ fontSize: '0.78rem' }}>{item.known}</span>
                                    <div
                                      className="transition-all cursor-pointer hover-glow"
                                      style={{
                                        height: `${knownPx}px`,
                                        width: '20px',
                                        background: '#10b981',
                                        boxShadow: '0 4px 16px rgba(16, 185, 129, 0.45)',
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
                        {/* Known Slice (Green) */}
                        <circle
                          cx="90"
                          cy="90"
                          r="70"
                          stroke="#10b981"
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
                        <div className="rounded-circle bg-success" style={{ width: '12px', height: '12px', boxShadow: '0 0 8px #10b981' }}></div>
                        <div>
                          <span className="d-block small text-secondary fw-semibold">Known Persons</span>
                          <strong className="fs-5 text-success font-mono">{knownCount} <span className="small text-muted">({knownPct}%)</span></strong>
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
                            <div className={`rounded-circle d-flex align-items-center justify-content-center flex-shrink-0 ${rep.status === 'KNOWN' ? 'bg-primary bg-opacity-10 text-primary' : rep.status === 'APPROVED' ? 'bg-success bg-opacity-10 text-success' : 'bg-danger bg-opacity-10 text-danger'}`}
                              style={{ width: '36px', height: '36px', border: rep.status === 'KNOWN' ? '1px solid rgba(13, 110, 253, 0.25)' : rep.status === 'APPROVED' ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(220, 53, 69, 0.25)' }}>
                              {rep.status === 'KNOWN' ? (
                                <i className="bi bi-person-fill fs-6"></i>
                              ) : rep.status === 'APPROVED' ? (
                                <i className="bi bi-person-check-fill fs-6"></i>
                              ) : (
                                <i className="bi bi-person-fill-exclamation fs-6"></i>
                              )}
                            </div>
                            <span className={`fw-bold text-truncate ${rep.status === 'KNOWN' ? 'text-dynamic' : rep.status === 'APPROVED' ? 'text-success' : 'text-danger'}`} style={{ maxWidth: '150px' }}>
                              {rep.person_name || "Unknown Person"}
                            </span>
                          </div>
                        </td>
                        <td className="text-center">
                          {rep.status === 'KNOWN' ? (
                            <span className="badge badge-known">Known</span>
                          ) : rep.status === 'APPROVED' ? (
                            <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)' }}>Approved</span>
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
                      background: exportFormat === 'pdf' ? 'rgba(239,68,68,0.15)' : 'rgba(5,150,105,0.12)',
                      border: exportFormat === 'pdf' ? '1px solid rgba(239,68,68,0.25)' : '1px solid rgba(5,150,105,0.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: exportFormat === 'pdf' ? '#ef4444' : '#059669',
                      fontSize: '1.1rem', flexShrink: 0
                    }}>
                      <i className={`bi ${exportFormat === 'pdf' ? 'bi-file-earmark-pdf-fill' : 'bi-file-earmark-spreadsheet-fill'}`}></i>
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '1rem', lineHeight: 1.2, color: 'var(--text-heading, #f0f6fc)' }}>
                        Export {exportFormat === 'pdf' ? 'PDF (With Photos)' : 'Excel Spreadsheet'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #8b949e)', marginTop: '2px' }}>
                        Choose filters, format, and download report
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

                    {/* Export Format (PDF with photos vs Excel) */}
                    <div>
                      <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary, #8b949e)', marginBottom: '10px' }}>
                        Export Format
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <button
                          type="button"
                          onClick={() => setExportFormat('pdf')}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            padding: '10px 12px',
                            borderRadius: '12px',
                            border: exportFormat === 'pdf' ? '2px solid #ef4444' : '1.5px solid var(--border-color, rgba(255,255,255,0.1))',
                            background: exportFormat === 'pdf' ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.02)',
                            color: exportFormat === 'pdf' ? '#ef4444' : 'var(--text-secondary, #8b949e)',
                            fontSize: '0.84rem',
                            fontWeight: exportFormat === 'pdf' ? 700 : 500,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <i className="bi bi-file-earmark-pdf-fill fs-6"></i>
                          <span>PDF (Photos)</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setExportFormat('excel')}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            padding: '10px 12px',
                            borderRadius: '12px',
                            border: exportFormat === 'excel' ? '2px solid #059669' : '1.5px solid var(--border-color, rgba(255,255,255,0.1))',
                            background: exportFormat === 'excel' ? 'rgba(5,150,105,0.15)' : 'rgba(255,255,255,0.02)',
                            color: exportFormat === 'excel' ? '#059669' : 'var(--text-secondary, #8b949e)',
                            fontSize: '0.84rem',
                            fontWeight: exportFormat === 'excel' ? 700 : 500,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <i className="bi bi-file-earmark-spreadsheet-fill fs-6"></i>
                          <span>Excel (.xlsx)</span>
                        </button>
                      </div>
                    </div>

                    {/* Time Range */}
                    <div>
                      <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary, #8b949e)', marginBottom: '10px' }}>
                        Time Range
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                        {[
                          { id: 'daily',   label: 'Daily',    icon: 'bi-lightning-charge-fill', color: '#059669' },
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
                          { id: 'all',     label: 'All',     icon: 'bi-people-fill',       color: '#059669' },
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
            background: 'rgba(0, 0, 0, 0.85)',
            zIndex: 99999,
            padding: '20px',
            paddingTop: 'max(calc(var(--status-bar-height, 0px) + 20px), calc(env(safe-area-inset-top, 0px) + 20px), 36px)',
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
