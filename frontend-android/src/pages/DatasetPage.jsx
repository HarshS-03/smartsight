import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import API from '../api/axios';
import getImageUrl from '../utils/imageUrl';

export default function DatasetPage() {
  const [activeTab, setActiveTab] = useState('registered');
  const [showAddPersonModal, setShowAddPersonModal] = useState(false);
  const [showAutoClassifyModal, setShowAutoClassifyModal] = useState(false);
  const [classifyState, setClassifyState] = useState('loading');
  const [classifiedGroups, setClassifiedGroups] = useState([]);
  const [classifyError, setClassifyError] = useState(null);
  const [registeringGroupId, setRegisteringGroupId] = useState(null);
  const [groupNames, setGroupNames] = useState({});
  const [classifiedGroupsChanged, setClassifiedGroupsChanged] = useState(false);

  const [persons, setPersons] = useState([]);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [visibleImageLimit, setVisibleImageLimit] = useState(16);

  const [unknowns, setUnknowns] = useState([]);
  const [selectedUnknownDate, setSelectedUnknownDate] = useState(null);
  const [visibleUnknownLimit, setVisibleUnknownLimit] = useState(16);
  const [previewFullImage, setPreviewFullImage] = useState(null);

  const [dragActive, setDragActive] = useState(false);
  const [newPersonName, setNewPersonName] = useState('');
  const [previewImages, setPreviewImages] = useState([]);
  const [filesToUpload, setFilesToUpload] = useState([]);
  const [moreFiles, setMoreFiles] = useState([]);
  const fileInputRef = useRef(null);
  const uploadMoreInputRef = useRef(null);
  const bulkFolderInputRef = useRef(null);
  const loaderRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        if (selectedPerson && selectedPerson.images.length > visibleImageLimit) {
          setVisibleImageLimit((prev) => prev + 16);
        } else if (selectedUnknownDate && selectedUnknownDate.logs.length > visibleUnknownLimit) {
          setVisibleUnknownLimit((prev) => prev + 16);
        }
      }
    }, { threshold: 0.1, rootMargin: '100px' });

    if (loaderRef.current) {
      observer.observe(loaderRef.current);
    }

    return () => {
      if (loaderRef.current) observer.disconnect();
    };
  }, [selectedPerson, visibleImageLimit, selectedUnknownDate, visibleUnknownLimit]);

  const fetchPersons = async () => {
    try {
      const response = await API.get('/persons/');
      setPersons(response.data);
    } catch (error) {
      console.error("Failed to fetch persons", error);
    }
  };

  const formatConfidence = (conf) => {
    if (conf === undefined || conf === null) return '0%';
    const num = parseFloat(conf);
    if (isNaN(num)) return '0%';
    const pct = num <= 1 ? Math.round(num * 100) : Math.round(num);
    return `${pct}%`;
  };

  const fetchUnknowns = async () => {
    try {
      const response = await API.get('/logs/?status=UNKNOWN');
      // Group logs by date
      const grouped = response.data.reduce((acc, log) => {
        const date = new Date(log.timestamp).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        if (!acc[date]) {
          acc[date] = { date_str: date, safe_id: date.replace(/[\s,]+/g, '-').toLowerCase(), logs: [] };
        }
        acc[date].logs.push({
          id: log.id,
          image_url: getImageUrl(log.image_path),
          confidence: log.confidence,
          time_str: new Date(log.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        });
        return acc;
      }, {});
      setUnknowns(Object.values(grouped));
    } catch (error) {
      console.error("Failed to fetch unknowns", error);
    }
  };

  useEffect(() => {
    fetchPersons();
    fetchUnknowns();
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
  }, [activeTab]);

  const handleDrag = function (e) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = function (e) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleChange = function (e) {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files);
    }
  };

  const handleFiles = (files) => {
    const newPreviews = [];
    const newFiles = [];
    Array.from(files).forEach(file => {
      if (file.type.startsWith('image/')) {
        newFiles.push(file);
        const reader = new FileReader();
        reader.onload = (e) => {
          newPreviews.push(e.target.result);
          if (newPreviews.length === Array.from(files).filter(f => f.type.startsWith('image/')).length) {
            setPreviewImages([...previewImages, ...newPreviews]);
            setFilesToUpload([...filesToUpload, ...newFiles]);
          }
        };
        reader.readAsDataURL(file);
      }
    });
  };

  const handleBulkFolderSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
      if (files.length === 0) return;

      let folderName = '';
      if (files[0].webkitRelativePath) {
        folderName = files[0].webkitRelativePath.split('/')[0];
      }

      if (folderName) {
        setNewPersonName(folderName);
      }

      const newPreviews = [];
      const newFiles = [];

      files.forEach(file => {
        newFiles.push(file);
        const reader = new FileReader();
        reader.onload = (ev) => {
          newPreviews.push(ev.target.result);
          if (newPreviews.length === files.length) {
            setPreviewImages(newPreviews);
            setFilesToUpload(newFiles);
            setShowAddPersonModal(true);
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const handleAddPersonSubmit = async (e) => {
    e.preventDefault();
    if (!newPersonName || filesToUpload.length === 0) return;

    const formData = new FormData();
    formData.append('name', newPersonName);
    filesToUpload.forEach(file => formData.append('images', file));

    try {
      await API.post('/dataset/upload/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setShowAddPersonModal(false);
      setNewPersonName('');
      setPreviewImages([]);
      setFilesToUpload([]);
      fetchPersons();
    } catch (error) {
      console.error("Failed to add person", error);
    }
  };

  const handleDeletePerson = async (id) => {
    try {
      await API.delete(`/persons/${id}/`);
      setSelectedPerson(null);
      fetchPersons();
    } catch (error) {
      console.error("Failed to delete person", error);
    }
  };

  const handleDeleteImage = async (imageId) => {
    try {
      await API.delete(`/persons/images/${imageId}/`);
      if (selectedPerson) {
        const updatedImages = selectedPerson.images.filter(img => img.id !== imageId);
        setSelectedPerson({ ...selectedPerson, images: updatedImages });
      }
      fetchPersons();
    } catch (error) {
      console.error("Failed to delete image", error);
    }
  };

  const handleMoreFilesChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setMoreFiles(Array.from(e.target.files));
    } else {
      setMoreFiles([]);
    }
  };

  const handleUploadMore = async (e) => {
    e.preventDefault();
    if (!selectedPerson || moreFiles.length === 0) return;

    const formData = new FormData();
    formData.append('name', selectedPerson.name);
    moreFiles.forEach(file => formData.append('images', file));

    try {
      await API.post('/dataset/upload/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setMoreFiles([]);
      if (uploadMoreInputRef.current) uploadMoreInputRef.current.value = '';
      fetchPersons();
      const res = await API.get(`/persons/${selectedPerson.id}/`);
      setSelectedPerson(res.data);
    } catch (error) {
      console.error("Failed to upload more images", error);
    }
  };

  const handleDismissLog = async (logId) => {
    try {
      await API.delete(`/logs/unknown/${logId}/dismiss/`);
      if (selectedUnknownDate) {
        const updatedLogs = selectedUnknownDate.logs.filter(l => l.id !== logId);
        if (updatedLogs.length === 0) {
          setSelectedUnknownDate(null);
        } else {
          setSelectedUnknownDate({ ...selectedUnknownDate, logs: updatedLogs });
        }
      }
      fetchUnknowns();
    } catch (error) {
      console.error("Failed to dismiss log", error);
    }
  };

  const startAutoClassification = async () => {
    setShowAutoClassifyModal(true);
    setClassifyState('loading');
    setClassifyError(null);
    setClassifiedGroups([]);
    setGroupNames({});
    setClassifiedGroupsChanged(false);

    try {
      const response = await API.post('/dataset/classify/');
      if (response.data && response.data.status === 'success') {
        const groups = response.data.groups || [];
        const formattedGroups = groups.map(group => ({
          ...group,
          images: (group.images || []).map(img => ({
            ...img,
            url: img.url ? (img.url.startsWith('http') ? img.url : `http://localhost:8000${img.url.startsWith('/') ? '' : '/'}${img.url}`) : ''
          }))
        }));
        setClassifiedGroups(formattedGroups);
        setClassifyState('results');
      } else {
        setClassifyError(response.data?.message || 'Failed to classify faces.');
        setClassifyState('results');
      }
    } catch (error) {
      console.error("Auto classification failed", error);
      setClassifyError(error.response?.data?.message || 'Network error or server processing timed out.');
      setClassifyState('results');
    }
  };

  const handleRemoveGroupImage = (groupId, filename) => {
    setClassifiedGroups(prev => {
      return prev.map(group => {
        if (group.id === groupId) {
          const updatedImages = group.images.filter(img => img.filename !== filename);
          return { ...group, images: updatedImages, count: updatedImages.length };
        }
        return group;
      }).filter(group => group.images.length > 0);
    });
  };

  const handleAssignGroup = async (groupId) => {
    const group = classifiedGroups.find(g => g.id === groupId);
    if (!group || group.images.length === 0) return;

    const personName = (groupNames[groupId] || '').trim();
    if (!personName) {
      alert('Please enter a name for the person.');
      return;
    }

    const filenames = group.images.map(img => img.filename);
    setRegisteringGroupId(groupId);

    try {
      const response = await API.post('/dataset/assign/', {
        group_images: filenames,
        person_name: personName
      });

      if (response.data && response.data.status === 'success') {
        setClassifiedGroups(prev => prev.filter(g => g.id !== groupId));
        setClassifiedGroupsChanged(true);
        fetchPersons();
        fetchUnknowns();
      } else {
        alert(response.data?.message || 'Failed to register group.');
      }
    } catch (error) {
      console.error("Failed to assign group", error);
      alert(error.response?.data?.message || 'Error occurred while registering group.');
    } finally {
      setRegisteringGroupId(null);
    }
  };

  const handleCloseAutoClassifyModal = () => {
    setShowAutoClassifyModal(false);
    if (classifiedGroupsChanged) {
      fetchPersons();
      fetchUnknowns();
    }
  };

  return (
    <>
      {/* Dataset Hero */}
      <section className="dataset-hero">
        <div className="dataset-hero-bg-wrapper">
          <div className="dataset-hero-bg"></div>
          <div className="dataset-orb"></div>
        </div>

        <div className="container position-relative" style={{ zIndex: 2 }}>
          <div className="row align-items-center text-center text-md-start">
            <div className="col-md-8 mb-3 mb-md-0">
              <h1 className="dataset-title mb-2">
                Dataset <span className="accent">Directory</span>
              </h1>
              <p className="mx-auto ms-md-0" style={{ color: 'var(--text-secondary)', fontSize: '.95rem', maxWidth: '500px' }}>Manage and organize
                person-specific training samples for the recognition model.</p>
            </div>
            <div className="col-md-4 text-center text-md-end d-flex gap-3 flex-shrink-0 justify-content-center justify-content-md-end">
              <input type="file" ref={bulkFolderInputRef} className="d-none" webkitdirectory="true" directory="true" multiple onChange={handleBulkFolderSelect} />
              <button type="button" className="btn-ds-outline" onClick={() => bulkFolderInputRef.current && bulkFolderInputRef.current.click()} title="Import Entire Folder of Images">
                <i className="bi bi-folders"></i> Bulk Import
              </button>
              <button type="button" className="btn-ds-primary" onClick={() => setShowAddPersonModal(true)}>
                <i className="bi bi-plus-circle-fill"></i> Add Person
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="container pt-0 pb-4">
        {/* Segment Switcher Control */}
        <div className="d-flex justify-content-center mb-4 w-100 px-2" data-reveal="true" data-reveal-delay="0">
          <div className="glass-segment-control rounded-pill d-flex w-100 overflow-hidden"
            style={{ maxWidth: '440px' }}>
            <button type="button" className={`segment-btn flex-fill w-50 d-flex align-items-center justify-content-center rounded-pill border-0 transition-all text-uppercase fw-800 ${activeTab === 'registered' ? 'active' : ''}`}
              onClick={() => setActiveTab('registered')}>
              <i className="bi bi-folder-check me-2 flex-shrink-0"></i>
              <span className="text-truncate">Registered People</span>
            </button>
            <button type="button" className={`segment-btn flex-fill w-50 d-flex align-items-center justify-content-center rounded-pill border-0 transition-all text-uppercase fw-800 ${activeTab === 'unknowns' ? 'active' : ''}`}
              onClick={() => setActiveTab('unknowns')}>
              <i className="bi bi-shield-exclamation me-2 flex-shrink-0"></i>
              <span className="text-truncate">Unknown Captures</span>
            </button>
          </div>
        </div>

        {/* Registered View Container */}
        {activeTab === 'registered' && (
          <div id="registered-view">
            {persons.length > 0 ? (
              <div className="row row-cols-2 row-cols-md-3 row-cols-lg-4 g-3 g-md-4">
                {persons.map((person, index) => (
                  <div className="col" key={person.id} data-reveal="true" data-reveal-delay="0">
                    <div className="folder-card folder-card-blue p-3 p-md-4 rounded-4 h-100 position-relative overflow-hidden d-flex flex-column justify-content-between"
                      onClick={() => setSelectedPerson(person)}>
                      <div className="folder-glow"></div>
                      <div>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <div className="folder-icon-wrapper">
                            <i className="bi bi-folder-fill text-primary"></i>
                          </div>
                          <span className="badge rounded-pill bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 px-2.5 py-1.5 fw-bold" style={{ fontSize: '0.74rem' }}>
                            {person.images.length} Photos
                          </span>
                        </div>
                        <div className="my-auto py-2">
                          <h5 className="fw-bold text-heading mb-0 text-capitalize text-truncate" style={{ fontSize: '1.15rem', lineHeight: 1.3 }}>{person.name}</h5>
                        </div>
                        <div className="pt-2 border-top border-white border-opacity-10">
                          <p className="text-secondary small mb-0 d-flex align-items-center" style={{ fontSize: '0.74rem' }}>
                            <i className="bi bi-calendar3 text-primary flex-shrink-0 me-2"></i>
                            <span className="text-truncate font-mono">{person.created_at}</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="d-flex flex-column align-items-center justify-content-center text-center py-5 w-100" style={{ minHeight: '50vh' }}>
                <div className="empty-state-icon mb-4">
                  <i className="bi bi-folder-x text-secondary opacity-25 display-1"></i>
                </div>
                <h3 className="text-dynamic fw-bold">Dataset Is Empty</h3>
                <p className="text-secondary mx-auto mb-4" style={{ maxWidth: '400px' }}>No face profiles have been registered yet. Start building your Smart Sight database by adding a new person.</p>
                <button className="btn btn-outline-primary rounded-pill px-5 py-2 shadow-sm" onClick={() => setShowAddPersonModal(true)}>
                  Get Started
                </button>
              </div>
            )}
          </div>
        )}

        {/* Unknown Captures View Container */}
        {activeTab === 'unknowns' && (
          <div id="unknown-captures-view">
            {/* Premium Auto-Classify Trigger Banner */}
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-4 mb-4 p-4 rounded-4"
              style={{ background: 'var(--bg-surface-solid)', border: '1px solid var(--border-color)' }}>
              <div>
                <h5 className="fw-bold text-dynamic mb-1 d-flex align-items-center gap-2">
                  <i className="bi bi-cpu text-primary"></i> AI Auto-Classification Engine
                </h5>
                <p className="text-secondary small mb-0" style={{ maxWidth: '580px' }}>Automatically cluster all unrecognized surveillance captures using DeepFace & DBSCAN Clustering. Group same-person captures to name and register them to your dataset instantly.</p>
              </div>
              <button type="button" className="btn-ds-primary flex-shrink-0 align-self-center align-self-md-auto" onClick={startAutoClassification}>
                <i className="bi bi-magic"></i>
                <span>Auto-Classify Faces</span>
              </button>
            </div>

            <div id="unknown-captures-ajax-container">
              {unknowns.length > 0 ? (
                <div className="row row-cols-2 row-cols-md-3 row-cols-lg-4 g-3 g-md-4">
                  {unknowns.map((group, index) => (
                    <div className="col" key={index} data-reveal="true" data-reveal-delay="0">
                      <div className="folder-card folder-card-red p-3 p-sm-3.5 p-md-4 rounded-4 h-100 position-relative overflow-hidden d-flex flex-column justify-content-between"
                        onClick={() => setSelectedUnknownDate(group)}>
                        <div className="folder-glow" style={{ background: 'radial-gradient(circle at 10% 10%, rgba(220, 53, 69, 0.1) 0%, transparent 50%)' }}></div>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <div className="folder-icon-wrapper" style={{ background: 'rgba(220, 53, 69, 0.1)', border: '1px solid rgba(220, 53, 69, 0.2)' }}>
                            <i className="bi bi-folder-fill text-danger"></i>
                          </div>
                          <span className="badge rounded-pill bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 px-2.5 py-1.5 fw-bold" style={{ fontSize: '0.74rem' }}>
                            {group.logs.length} Photos
                          </span>
                        </div>
                        <div className="my-auto py-2">
                          <h5 className="fw-bold text-heading mb-0 text-truncate" style={{ fontSize: '1.15rem', lineHeight: 1.3 }}>{group.date_str}</h5>
                        </div>
                        <div className="pt-2 border-top border-white border-opacity-10">
                          <p className="text-secondary small mb-0 d-flex align-items-center" style={{ fontSize: '0.74rem' }}>
                            <i className="bi bi-shield-exclamation text-danger flex-shrink-0 me-2"></i>
                            <span className="text-truncate">Unknown Captures</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="d-flex flex-column align-items-center justify-content-center text-center py-5 w-100" style={{ minHeight: '50vh' }}>
                  <div className="empty-state-icon mb-4">
                    <i className="bi bi-shield-slash text-secondary opacity-25 display-1"></i>
                  </div>
                  <h3 className="text-dynamic fw-bold">No Unknown Captures</h3>
                  <p className="text-secondary mx-auto mb-4" style={{ maxWidth: '400px' }}>All detected individuals are recognized or no strangers have triggered alerts yet.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add Person Modal */}
      {/* Add Person Modal */}
      {showAddPersonModal && (
        <>
          <div className="modal-backdrop fade show glass-backdrop" style={{ opacity: 0.7, backdropFilter: 'blur(8px)' }}></div>
          <div className="modal fade show d-block" tabIndex="-1" aria-hidden="true">
            <div className="modal-dialog modal-dialog-centered modal-lg">
              <div className="modal-content overflow-hidden shadow-2xl border-0">
                <div className="modal-header border-0 p-4 pb-0">
                  <h5 className="modal-title fw-bold text-dynamic d-flex align-items-center">
                    <i className="bi bi-person-plus-fill text-primary me-2"></i>
                    New Dataset Folder
                  </h5>
                  <button type="button" className="btn-close text-dynamic" onClick={() => setShowAddPersonModal(false)} aria-label="Close"></button>
                </div>
                <form onSubmit={handleAddPersonSubmit}>
                  <div className="modal-body p-4">
                    <div className="mb-4">
                      <label className="form-label text-heading small text-uppercase fw-800 letter-spacing-wide mb-2">Person Identification</label>
                      <div className="form-floating custom-form-floating">
                        <input type="text" className="form-control rounded-pill px-4" placeholder="Enter person name" value={newPersonName} onChange={e => setNewPersonName(e.target.value)} required />
                        <label className="ps-4">Full Name</label>
                      </div>
                    </div>

                    <div className="mb-2">
                      <label className="form-label text-heading small text-uppercase fw-800 letter-spacing-wide mb-2">Training Samples</label>
                      <div className={`drop-zone d-flex flex-column align-items-center justify-content-center p-3 p-md-5 rounded-4 transition-all ${dragActive ? 'dragover' : ''}`}
                        onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}>
                        <div className="drop-zone-icon mb-3">
                          <i className="bi bi-cloud-arrow-up-fill text-primary display-4"></i>
                        </div>
                        <h6 className="text-dynamic fw-bold mb-1">Drag & Drop Folder or Images</h6>
                        <p className="text-secondary small mb-3">Folder name will be used as Person Name automatically</p>
                        <input type="file" ref={fileInputRef} className="d-none" multiple accept="image/*" onChange={handleChange} />
                        <div className="d-flex gap-2 flex-wrap justify-content-center">
                          <button type="button" className="btn btn-secondary btn-sm rounded-pill px-4" onClick={() => fileInputRef.current.click()}>
                            <i className="bi bi-images me-1.5 text-primary"></i> Select Files
                          </button>
                          <button type="button" className="btn btn-primary btn-sm rounded-pill px-4" onClick={() => bulkFolderInputRef.current && bulkFolderInputRef.current.click()}>
                            <i className="bi bi-folder-plus me-1.5"></i> Select Folder
                          </button>
                        </div>
                      </div>

                      {previewImages.length > 0 && (
                        <div className="row row-cols-4 g-2 mt-3">
                          {previewImages.map((src, i) => (
                            <div className="col" key={i}>
                              <div className="position-relative rounded-2 overflow-hidden border border-secondary border-opacity-25" style={{ aspectRatio: 1 }}>
                                <img src={src} className="w-100 h-100 object-fit-cover" alt="preview" loading="lazy" decoding="async" />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="modal-footer border-0 p-4 pt-0 d-flex gap-2">
                    <button type="button" className="btn btn-cancel-red rounded-pill px-4 flex-grow-1" onClick={() => {
                      setShowAddPersonModal(false);
                      setPreviewImages([]);
                      setFilesToUpload([]);
                      setNewPersonName('');
                    }}>Cancel</button>
                    <button type="submit" className="btn btn-primary px-5 rounded-pill fw-bold flex-grow-1">Initialize Folder</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Person Detail Modal - Mounted directly on document.body via React Portal */}
      {selectedPerson && createPortal(
        <>
          <div className="modal-backdrop fade show glass-backdrop" style={{ opacity: 0.7, backdropFilter: 'blur(8px)', zIndex: 10540 }} onClick={() => setSelectedPerson(null)}></div>
          <div className="modal fade show d-block" tabIndex="-1" aria-hidden="true" onClick={() => setSelectedPerson(null)} style={{ zIndex: 10550 }}>
            <div className="modal-dialog modal-xl modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
              <div className="modal-content overflow-hidden shadow-2xl border-0">
                <div className="modal-header border-0 p-4 pb-3 d-flex align-items-center justify-content-between">
                  <div className="d-flex align-items-center">
                    <div className="bg-primary bg-opacity-10 rounded-4 me-3 border border-primary border-opacity-10 flex-shrink-0 d-flex align-items-center justify-content-center" style={{ width: '48px', height: '48px' }}>
                      <i className="bi bi-folder-fill text-primary fs-4"></i>
                    </div>
                    <div>
                      <h4 className="modal-title fw-bold text-heading text-capitalize mb-1" style={{ lineHeight: 1.2 }}>{selectedPerson.name}</h4>
                      <div className="text-secondary small d-flex align-items-center gap-2">
                        <i className="bi bi-shield-check text-success flex-shrink-0 me-1.5"></i>
                        <span className="text-nowrap fw-semibold">{selectedPerson.images.length} Images</span>
                      </div>
                    </div>
                  </div>
                  <div className="d-flex align-items-center gap-2 flex-shrink-0 ms-auto">
                    <button type="button" className="btn btn-cancel-red btn-sm rounded-pill px-3.5 py-1.5 text-nowrap d-flex align-items-center gap-2 shadow-sm" onClick={() => { if (selectedPerson) handleDeletePerson(selectedPerson.id); }}>
                      <i className="bi bi-trash3-fill" style={{ fontSize: '0.85rem' }}></i>
                      <span className="small fw-bold">Delete</span>
                    </button>
                    <button type="button" className="btn-close text-dynamic" onClick={() => setSelectedPerson(null)} aria-label="Close"></button>
                  </div>
                </div>
                <div className="modal-body p-4 pt-1" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                  {selectedPerson.images.length > 0 ? (
                    <>
                      <div className="row row-cols-2 row-cols-sm-3 row-cols-md-4 row-cols-lg-5 g-3">
                        {selectedPerson.images.slice(0, visibleImageLimit).map(img => {
                          const fullUrl = getImageUrl(img.url || img.image);
                          return (
                            <div className="col" key={img.id}>
                              <div className="unknown-card rounded-4 overflow-hidden position-relative h-100 shadow-sm border border-secondary border-opacity-25 cursor-pointer" onClick={() => setPreviewFullImage({ url: fullUrl, id: img.id, type: 'person' })}>
                                <div className="position-relative overflow-hidden" style={{ background: '#0f172a', aspectRatio: '1/1' }}>
                                  <img src={fullUrl} className="w-100 h-100 object-fit-cover d-block" alt="Sample" loading="lazy" decoding="async" />
                                  <div className="unknown-card-actions">
                                    <button type="button" className="btn btn-primary btn-sm rounded-circle shadow-lg" title="View Full Image" onClick={(e) => { e.stopPropagation(); setPreviewFullImage({ url: fullUrl, id: img.id, type: 'person' }); }}>
                                      <i className="bi bi-eye-fill"></i>
                                    </button>
                                    <button type="button" className="btn btn-danger btn-sm rounded-circle shadow-lg" title="Delete Image" onClick={(e) => { e.stopPropagation(); handleDeleteImage(img.id); }}>
                                      <i className="bi bi-trash-fill"></i>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {selectedPerson.images.length > visibleImageLimit && (
                        <div ref={loaderRef} className="text-center mt-4 py-3">
                          <div className="spinner-border text-primary spinner-border-sm" role="status">
                            <span className="visually-hidden">Loading...</span>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-5 opacity-50">
                      <i className="bi bi-images display-1 mb-3"></i>
                      <h5 className="text-heading">No training data found</h5>
                    </div>
                  )}
                </div>
                <div className="modal-footer border-0 p-3 p-md-4" style={{ background: 'rgba(255, 255, 255, 0.4)', borderTop: '1px solid rgba(15, 23, 42, 0.08)' }}>
                  <form className="w-100 d-flex flex-column gap-3" onSubmit={handleUploadMore}>
                    <input
                      type="file"
                      ref={uploadMoreInputRef}
                      className="d-none"
                      multiple
                      accept="image/*"
                      onChange={handleMoreFilesChange}
                    />

                    {/* Glassy Pill Upload Selector */}
                    <div className="upload-pill-bar p-1.5 rounded-pill d-flex align-items-center justify-content-between gap-2"
                      style={{
                        background: 'rgba(13, 110, 253, 0.06)',
                        border: '1px solid rgba(13, 110, 253, 0.2)',
                      }}>
                      <button
                        type="button"
                        className="btn btn-primary rounded-pill px-4 py-2 text-nowrap d-flex align-items-center gap-2 shadow-sm flex-shrink-0"
                        onClick={() => uploadMoreInputRef.current && uploadMoreInputRef.current.click()}
                      >
                        <i className="bi bi-images fs-6"></i>
                        <span className="fw-bold">Choose Photos</span>
                      </button>

                      <div className="pe-3 d-flex align-items-center gap-2 min-w-0">
                        <i className={`bi ${moreFiles.length > 0 ? 'bi-check-circle-fill text-success fs-6' : 'bi-info-circle text-muted'}`}></i>
                        <span className="small text-heading text-truncate font-mono fw-semibold" style={{ fontSize: '0.82rem' }}>
                          {moreFiles.length > 0
                            ? `${moreFiles.length} photos selected`
                            : 'No new photos'}
                        </span>
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="btn btn-primary rounded-pill py-2.5 w-100 text-nowrap d-flex align-items-center justify-content-center gap-2 shadow-sm"
                      disabled={moreFiles.length === 0}
                      style={{
                        opacity: moreFiles.length === 0 ? 0.45 : 1,
                        cursor: moreFiles.length === 0 ? 'not-allowed' : 'pointer',
                        transition: 'all 0.3s ease'
                      }}
                    >
                      <i className="bi bi-cloud-arrow-up-fill fs-5"></i>
                      <span className="fw-bold">Upload More</span>
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}

      {/* Unknown Date Modal - Mounted directly on document.body via React Portal */}
      {selectedUnknownDate && createPortal(
        <>
          <div className="modal-backdrop fade show glass-backdrop" style={{ opacity: 0.7, backdropFilter: 'blur(8px)' }}></div>
          <div className="modal fade show d-block" tabIndex="-1" aria-hidden="true">
            <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
              <div className="modal-content overflow-hidden"
                style={{ background: 'var(--modal-bg)', border: '1px solid var(--modal-border)', borderRadius: '24px', backdropFilter: 'blur(30px)' }}>
                <div className="modal-header border-0 p-4 d-flex align-items-start">
                  <div className="d-flex align-items-center">
                    <div className="bg-danger bg-opacity-10 rounded-4 p-3 me-3 border border-danger border-opacity-10">
                      <i className="bi bi-folder-fill text-danger fs-3"></i>
                    </div>
                    <div>
                      <h4 className="modal-title fw-bold text-dynamic mb-1">{selectedUnknownDate.date_str}</h4>
                      <div className="text-secondary small d-flex align-items-center gap-2">
                        <i className="bi bi-shield-exclamation text-danger"></i>
                        <span>{selectedUnknownDate.logs.length} Unknown Captures</span>
                      </div>
                    </div>
                  </div>
                  <button type="button" className="btn-close opacity-75 ms-auto" onClick={() => setSelectedUnknownDate(null)}></button>
                </div>
                <div className="modal-body p-4 pt-0">
                  <div className="row row-cols-2 row-cols-md-4 row-cols-lg-5 g-3">
                    {selectedUnknownDate.logs.slice(0, visibleUnknownLimit).map(log => {
                      const fullImgUrl = getImageUrl(log.image_url || log.image_path);
                      return (
                        <div className="col" key={log.id}>
                          <div className="unknown-card rounded-4 overflow-hidden position-relative h-100 shadow-sm border border-secondary border-opacity-25 cursor-pointer" onClick={() => setPreviewFullImage({ url: fullImgUrl, id: log.id, type: 'unknown' })}>
                            <div className="position-relative overflow-hidden" style={{ background: '#0f172a', aspectRatio: '1/1' }}>
                              <img src={fullImgUrl} className="w-100 h-100 object-fit-cover d-block" alt="Captured Target" loading="lazy" decoding="async" />
                              <div className="unknown-card-actions">
                                <button type="button" className="btn btn-primary btn-sm rounded-circle shadow-lg" title="View Full Image" onClick={(e) => { e.stopPropagation(); setPreviewFullImage({ url: fullImgUrl, id: log.id, type: 'unknown' }); }}>
                                  <i className="bi bi-eye-fill"></i>
                                </button>
                                <button type="button" className="btn btn-danger btn-sm rounded-circle shadow-lg" title="Dismiss Log" onClick={(e) => { e.stopPropagation(); handleDismissLog(log.id); }}>
                                  <i className="bi bi-trash-fill"></i>
                                </button>
                              </div>
                            </div>
                            <div className="p-3">
                              <div className="d-flex justify-content-between align-items-center mb-2">
                                <span className="badge rounded-pill bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 px-2.5 py-1 text-uppercase fw-800" style={{ fontSize: '0.68rem' }}>
                                  Stranger ({formatConfidence(log.confidence)})
                                </span>
                              </div>
                              <div className="text-secondary small d-flex align-items-center me-2" style={{ fontSize: '0.75rem' }}>
                                <i className="bi bi-clock-fill text-secondary opacity-50 me-2"></i>
                                <span>{log.time_str}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {selectedUnknownDate.logs.length > visibleUnknownLimit && (
                    <div ref={loaderRef} className="text-center mt-4 py-3">
                      <div className="spinner-border text-danger spinner-border-sm" role="status">
                        <span className="visually-hidden">Loading...</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}

      {/* Auto Classification Modal */}
      {showAutoClassifyModal && (
        <>
          <div className="modal-backdrop fade show glass-backdrop" style={{ opacity: 0.7, backdropFilter: 'blur(8px)' }}></div>
          <div className="modal fade show d-block" tabIndex="-1" data-bs-backdrop="static" aria-hidden="true">
            <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
              <div className="modal-content overflow-hidden"
                style={{ background: 'var(--modal-bg)', border: '1px solid var(--modal-border)', borderRadius: '24px', backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)' }}>
                <div className="modal-header border-0 p-4">
                  <h5 className="modal-title fw-bold text-dynamic d-flex align-items-center">
                    <i className="bi bi-cpu-fill text-primary me-2"></i>
                    AI Face Auto-Classification
                  </h5>
                  <button type="button" className="btn-close opacity-75" onClick={handleCloseAutoClassifyModal}></button>
                </div>
                <div className="modal-body p-4 pt-0">
                  {classifyState === 'loading' ? (
                    <div id="classify-loading" className="text-center py-5">
                      <div className="ai-scanner-container">
                        <div className="ai-scanner-face"></div>
                        <div className="ai-scanner-line"></div>
                      </div>
                      <h5 className="text-dynamic fw-bold mb-2">ArcFace Neural Engine Active</h5>
                      <div className="ai-status-text mb-3">COMPUTING BIOMETRIC EMBEDDINGS<span className="typing-dots"></span></div>
                      <p className="text-secondary small mx-auto" style={{ maxWidth: '380px', lineHeight: 1.6 }}>
                        Extracting 512-d facial features and clustering via DBSCAN Clustering. This process separates distinct individuals into highly accurate identification groups.
                      </p>
                    </div>
                  ) : (
                    <div id="classify-results">
                      {classifyError && (
                        <div className="alert alert-danger border-0 rounded-4 p-3 mb-4 d-flex align-items-center justify-content-between" style={{ background: 'rgba(220, 53, 69, 0.15)', color: '#f87171' }}>
                          <div className="d-flex align-items-center gap-2">
                            <i className="bi bi-exclamation-triangle-fill fs-5"></i>
                            <span>{classifyError}</span>
                          </div>
                          <button className="btn btn-outline-danger btn-sm rounded-pill px-3" onClick={startAutoClassification}>Retry</button>
                        </div>
                      )}

                      {classifiedGroups.length === 0 ? (
                        <div className="text-center py-5 opacity-50">
                          <i className="bi bi-emoji-smile display-4 mb-3 text-secondary"></i>
                          <h5>No unrecognized faces to classify.</h5>
                        </div>
                      ) : (
                        <div className="d-flex flex-column gap-4">
                          <datalist id="registered-person-names-list">
                            {persons.map(p => (
                              <option key={p.id} value={p.name} />
                            ))}
                          </datalist>

                          {classifiedGroups.map((group, idx) => {
                            let title = '';
                            let badgeClass = 'bg-primary';
                            let badgeText = '';
                            let headerIcon = 'bi-person-bounding-box text-primary';

                            if (group.is_noface) {
                              title = 'No Face Detected';
                              badgeClass = 'bg-secondary';
                              badgeText = `Unrecognized Shapes (${group.images.length})`;
                              headerIcon = 'bi-question-circle text-warning';
                            } else if (group.is_cluster) {
                              title = `Face Group #${idx + 1}`;
                              badgeClass = 'bg-primary';
                              badgeText = `${group.images.length} Match captures`;
                              headerIcon = 'bi-person-bounding-box text-primary';
                            } else {
                              title = 'Single Stranger Capture';
                              badgeClass = 'bg-danger';
                              badgeText = 'Singleton Outlier';
                              headerIcon = 'bi-person-badge text-danger';
                            }

                            return (
                              <div key={group.id} className="classify-group-card p-4 rounded-4 position-relative border border-secondary border-opacity-25" style={{ background: 'var(--bg-surface-solid)', backdropFilter: 'blur(16px)' }}>
                                <div className="d-flex justify-content-between align-items-center mb-3">
                                  <h6 className="fw-bold text-dynamic mb-0 d-flex align-items-center gap-2">
                                    <i className={`bi ${headerIcon}`}></i> {title}
                                  </h6>
                                  <span className={`badge rounded-pill ${badgeClass} bg-opacity-20 text-white border border-white border-opacity-10 px-3 py-2`}>
                                    {badgeText}
                                  </span>
                                </div>

                                <div className="d-flex flex-wrap gap-3 py-2 mb-3">
                                  {group.images.map(img => (
                                    <div key={img.filename} className="position-relative" style={{ width: '80px', height: '80px' }}>
                                      <img
                                        src={img.url}
                                        alt="Face thumb"
                                        className="w-100 h-100 object-fit-cover rounded-3 border border-secondary border-opacity-25 shadow-sm"
                                        style={{ background: '#0f172a' }}
                                      />
                                      <button
                                        type="button"
                                        className="btn btn-danger btn-sm position-absolute top-0 end-0 rounded-circle p-0 d-flex align-items-center justify-content-center shadow-sm"
                                        style={{ transform: 'translate(30%, -30%)', width: '22px', height: '22px', zIndex: 5 }}
                                        onClick={() => handleRemoveGroupImage(group.id, img.filename)}
                                        title="Remove from group"
                                      >
                                        <i className="bi bi-x fs-6"></i>
                                      </button>
                                    </div>
                                  ))}
                                </div>

                                <div className="d-flex flex-column flex-sm-row gap-2">
                                  <input
                                    type="text"
                                    className="form-control rounded-pill px-3 py-2 text-capitalize flex-grow-1"
                                    placeholder="Enter person name to register..."
                                    list="registered-person-names-list"
                                    value={groupNames[group.id] || ''}
                                    onChange={e => setGroupNames({ ...groupNames, [group.id]: e.target.value })}
                                    style={{ fontSize: '0.85rem', background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-heading)' }}
                                  />
                                  <button
                                    type="button"
                                    className="btn btn-primary rounded-pill px-4 text-nowrap d-flex align-items-center justify-content-center gap-2 fw-bold"
                                    disabled={registeringGroupId === group.id}
                                    onClick={() => handleAssignGroup(group.id)}
                                  >
                                    {registeringGroupId === group.id ? (
                                      <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                                    ) : (
                                      <>
                                        <i className="bi bi-check-circle-fill"></i>
                                        <span>Register</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* In-App Image Lightbox Preview Modal - Mounted directly on document.body via React Portal */}
      {previewFullImage && createPortal(
        (() => {
          const imageUrl = typeof previewFullImage === 'object' ? previewFullImage.url : previewFullImage;
          const imageId = typeof previewFullImage === 'object' ? previewFullImage.id : null;
          const imageType = typeof previewFullImage === 'object' ? previewFullImage.type : null;

          const handleDeleteCurrent = async (e) => {
            e.stopPropagation();
            if (!imageId) return;
            if (imageType === 'person') {
              await handleDeleteImage(imageId);
            } else if (imageType === 'unknown') {
              await handleDismissLog(imageId);
            }
            setPreviewFullImage(null);
          };

          return (
            <div
              className="position-fixed top-0 start-0 w-100 h-100 d-flex flex-column align-items-center justify-content-center p-3 p-md-4"
              style={{
                zIndex: 99999,
                backgroundColor: 'rgba(0, 0, 0, 0.95)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                width: '100vw',
                height: '100vh'
              }}
              onClick={() => setPreviewFullImage(null)}
            >
              {/* Top Floating Control Bar */}
              <div className="position-absolute top-0 start-0 end-0 d-flex align-items-center justify-content-between p-3 px-md-4" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.85), transparent)', zIndex: 100000 }} onClick={e => e.stopPropagation()}>
                <div className="d-flex align-items-center gap-2 text-white">
                  <i className="bi bi-image text-primary fs-5"></i>
                  <span className="fw-bold small">Dataset Image Preview</span>
                </div>
                <div className="d-flex align-items-center gap-2">
                  {imageId && (
                    <button
                      type="button"
                      className="btn btn-danger btn-sm rounded-pill px-3 py-1.5 d-flex align-items-center gap-2 shadow-lg"
                      onClick={handleDeleteCurrent}
                      title="Delete Image"
                    >
                      <i className="bi bi-trash3-fill"></i>
                      <span className="small fw-bold">Delete</span>
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-dark rounded-circle d-flex align-items-center justify-content-center p-0 border border-white border-opacity-25 text-white shadow-lg"
                    style={{ width: '42px', height: '42px', background: 'rgba(255,255,255,0.2)' }}
                    onClick={() => setPreviewFullImage(null)}
                    title="Close Preview"
                  >
                    <i className="bi bi-x-lg fs-6"></i>
                  </button>
                </div>
              </div>

              {/* Full Image Container */}
              <div className="d-flex align-items-center justify-content-center w-100 h-100 my-auto" onClick={e => e.stopPropagation()}>
                <img
                  src={imageUrl}
                  className="img-fluid rounded-4 shadow-2xl border border-white border-opacity-15"
                  alt="Full Preview"
                  style={{ maxHeight: '82vh', maxWidth: '95vw', objectFit: 'contain' }}
                />
              </div>
            </div>
          );
        })(),
        document.body
      )}
    </>
  );
}
