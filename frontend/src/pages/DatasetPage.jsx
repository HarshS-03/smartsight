import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import API from '../api/axios';
import getImageUrl from '../utils/imageUrl';

export const CATEGORIES = [
  { key: 'ALL', label: 'All Personnel', icon: 'bi-people-fill' },
  { key: 'STUDENT', label: 'Students', icon: 'bi-mortarboard-fill' },
  { key: 'FACULTY', label: 'Faculties', icon: 'bi-person-video3' },
  { key: 'OFFICE_STAFF', label: 'Office Members', icon: 'bi-briefcase-fill' },
  { key: 'PEON', label: 'Peons', icon: 'bi-person-badge-fill' },
  { key: 'LAB_STAFF', label: 'Lab Staff', icon: 'bi-cpu-fill' },
];

export const COURSE_CONFIG = {
  AIML: { label: 'AIML', duration: '2 Years', totalSem: 4, icon: 'bi-robot' },
  MCA: { label: 'MCA', duration: '2 Years', totalSem: 4, icon: 'bi-pc-display' },
  PGDCA: { label: 'PGDCA', duration: '1 Year', totalSem: 2, icon: 'bi-award' },
  CS: { label: 'CS', duration: '5 Years', totalSem: 10, icon: 'bi-terminal' },
};

export const STUDENT_COURSES = Object.keys(COURSE_CONFIG);

export const getCourseSemesters = (courseKey) => {
  const config = COURSE_CONFIG[courseKey];
  if (!config) return [];
  return Array.from({ length: config.totalSem }, (_, i) => `Sem ${i + 1}`);
};

export const matchesCourseAndSem = (className, courseKey, sem) => {
  if (!className) return false;
  const upper = className.toUpperCase();
  if (courseKey && courseKey !== 'ALL' && courseKey !== 'Unassigned') {
    if (!upper.includes(courseKey.toUpperCase())) return false;
  }
  if (sem && sem !== 'ALL') {
    const regex = new RegExp(`\\b${sem}\\b`, 'i');
    if (!regex.test(className)) {
      const noSpace = sem.replace(/\s+/g, '');
      const regexNoSpace = new RegExp(`\\b${noSpace}\\b`, 'i');
      if (!regexNoSpace.test(className)) return false;
    }
  }
  return true;
};

export const getCategoryBadge = (category, className, dept) => {
  switch (category) {
    case 'STUDENT':
      return {
        label: className ? `Student • ${className}` : 'Student',
        bg: 'rgba(37, 99, 235, 0.12)',
        color: '#60a5fa',
        border: 'rgba(37, 99, 235, 0.28)',
        icon: 'bi-mortarboard-fill'
      };
    case 'FACULTY':
      return {
        label: dept ? `Faculty • ${dept}` : 'Faculty',
        bg: 'rgba(168, 85, 247, 0.12)',
        color: '#a855f7',
        border: 'rgba(168, 85, 247, 0.28)',
        icon: 'bi-person-video3'
      };
    case 'OFFICE_STAFF':
      return {
        label: dept ? `Office • ${dept}` : 'Office Member',
        bg: 'rgba(245, 158, 11, 0.12)',
        color: '#f59e0b',
        border: 'rgba(245, 158, 11, 0.28)',
        icon: 'bi-briefcase-fill'
      };
    case 'PEON':
      return {
        label: dept ? `Peon • ${dept}` : 'Peon',
        bg: 'rgba(100, 116, 139, 0.12)',
        color: '#94a3b8',
        border: 'rgba(100, 116, 139, 0.28)',
        icon: 'bi-person-badge-fill'
      };
    case 'LAB_STAFF':
      return {
        label: dept ? `Lab Staff • ${dept}` : 'Lab Staff',
        bg: 'rgba(6, 182, 212, 0.12)',
        color: '#06b6d4',
        border: 'rgba(6, 182, 212, 0.28)',
        icon: 'bi-cpu-fill'
      };
    default:
      return {
        label: className ? `Student • ${className}` : 'Student',
        bg: 'rgba(37, 99, 235, 0.12)',
        color: '#60a5fa',
        border: 'rgba(37, 99, 235, 0.28)',
        icon: 'bi-mortarboard-fill'
      };
  }
};

export default function DatasetPage() {
  const [activeTab, setActiveTab] = useState('registered');
  const [showAddPersonModal, setShowAddPersonModal] = useState(false);
  const [showAutoClassifyModal, setShowAutoClassifyModal] = useState(false);
  const [classifyState, setClassifyState] = useState('loading');
  const [classifiedGroups, setClassifiedGroups] = useState([]);
  const [classifyError, setClassifyError] = useState(null);
  const [registeringGroupId, setRegisteringGroupId] = useState(null);
  const [groupNames, setGroupNames] = useState({});
  const [groupMeta, setGroupMeta] = useState({});
  const [classifiedGroupsChanged, setClassifiedGroupsChanged] = useState(false);

  const [persons, setPersons] = useState([]);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [visibleImageLimit, setVisibleImageLimit] = useState(16);

  // Category & Course / Semester Filter State
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedCourse, setSelectedCourse] = useState('ALL');
  const [selectedSem, setSelectedSem] = useState('ALL');
  const [personSearchQuery, setPersonSearchQuery] = useState('');

  // Add Person form state
  const [newPersonCategory, setNewPersonCategory] = useState('STUDENT');
  const [newStudentCourse, setNewStudentCourse] = useState('AIML');
  const [newStudentSem, setNewStudentSem] = useState('Sem 1');
  const [newPersonClass, setNewPersonClass] = useState('AIML - Sem 1');
  const [newPersonDept, setNewPersonDept] = useState('');

  const handleAddPersonCourseSelect = (course) => {
    setNewStudentCourse(course);
    const maxSems = COURSE_CONFIG[course]?.totalSem || 4;
    let sem = newStudentSem;
    const currentSemNum = parseInt(sem.replace(/\D/g, ''), 10) || 1;
    if (currentSemNum > maxSems) {
      sem = 'Sem 1';
      setNewStudentSem('Sem 1');
    }
    setNewPersonClass(`${course} - ${sem}`);
  };

  const handleAddPersonSemSelect = (sem) => {
    setNewStudentSem(sem);
    setNewPersonClass(`${newStudentCourse} - ${sem}`);
  };

  // Editing person role / class inline
  const [isEditingPersonMeta, setIsEditingPersonMeta] = useState(false);
  const [editPersonName, setEditPersonName] = useState('');
  const [editCategory, setEditCategory] = useState('STUDENT');
  const [editStudentCourse, setEditStudentCourse] = useState('AIML');
  const [editStudentSem, setEditStudentSem] = useState('Sem 1');
  const [editClass, setEditClass] = useState('');
  const [editDept, setEditDept] = useState('');
  const [savingEditMeta, setSavingEditMeta] = useState(false);

  const handleEditCourseSelect = (course) => {
    setEditStudentCourse(course);
    const maxSems = COURSE_CONFIG[course]?.totalSem || 4;
    let sem = editStudentSem;
    const currentSemNum = parseInt(sem.replace(/\D/g, ''), 10) || 1;
    if (currentSemNum > maxSems) {
      sem = 'Sem 1';
      setEditStudentSem('Sem 1');
    }
    setEditClass(`${course} - ${sem}`);
  };

  const handleEditSemSelect = (sem) => {
    setEditStudentSem(sem);
    setEditClass(`${editStudentCourse} - ${sem}`);
  };

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
  const batchFolderInputRef = useRef(null);
  const loaderRef = useRef(null);

  // Batch Multi-Folder Upload State
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchGroups, setBatchGroups] = useState([]);
  const [batchCategory, setBatchCategory] = useState('STUDENT');
  const [batchCourse, setBatchCourse] = useState('AIML');
  const [batchSem, setBatchSem] = useState('Sem 1');
  const [batchClass, setBatchClass] = useState('AIML - Sem 1');
  const [batchDept, setBatchDept] = useState('');
  const [batchUploading, setBatchUploading] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, currentName: '' });

  // Toast notification state
  const [toasts, setToasts] = useState([]);
  const toastIdRef = useRef(0);

  const showToast = (message, type = 'success', duration = 4500) => {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  };

  // Upload progress state (for single-person uploads)
  const [uploadProgress, setUploadProgress] = useState(null); // { status: 'uploading'|'computing', personName, imageCount, embeddingsComputed }

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

  const availableClasses = useMemo(() => {
    const list = [...STUDENT_COURSES];
    let hasUnassigned = false;
    persons.forEach(p => {
      if (p.category === 'STUDENT' || !p.category) {
        if (p.class_name && p.class_name.trim()) {
          const trimmed = p.class_name.trim();
          const isKnownCourse = STUDENT_COURSES.some(c => trimmed.toUpperCase().startsWith(c));
          if (!isKnownCourse && !list.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
            list.push(trimmed);
          }
        } else {
          hasUnassigned = true;
        }
      }
    });
    if (hasUnassigned) {
      list.push('Unassigned');
    }
    return list;
  }, [persons]);

  const filteredPersons = useMemo(() => {
    return persons.filter(person => {
      // Category filter
      if (selectedCategory !== 'ALL' && (person.category || 'STUDENT') !== selectedCategory) {
        return false;
      }
      // Course / Branch filter
      if ((selectedCategory === 'ALL' || selectedCategory === 'STUDENT') && selectedCourse !== 'ALL') {
        if (selectedCourse === 'Unassigned') {
          if (person.class_name && person.class_name.trim()) return false;
        } else {
          const pClass = (person.class_name || '').toUpperCase();
          const targetCourse = selectedCourse.toUpperCase();
          if (!pClass.includes(targetCourse)) return false;

          // Semester filter with exact matching
          if (selectedSem !== 'ALL') {
            if (!matchesCourseAndSem(person.class_name, selectedCourse, selectedSem)) return false;
          }
        }
      }
      // Search query
      if (personSearchQuery.trim()) {
        const q = personSearchQuery.toLowerCase();
        const matchesName = (person.name || '').toLowerCase().includes(q);
        const matchesClass = (person.class_name || '').toLowerCase().includes(q);
        const matchesDept = (person.department || '').toLowerCase().includes(q);
        if (!matchesName && !matchesClass && !matchesDept) return false;
      }
      return true;
    });
  }, [persons, selectedCategory, selectedCourse, selectedSem, personSearchQuery]);

  const openPersonDetail = (person) => {
    setSelectedPerson(person);
    setEditPersonName(person.name || '');
    const cat = person.category || 'STUDENT';
    setEditCategory(cat);
    const cls = person.class_name || '';
    setEditClass(cls);
    setEditDept(person.department || '');

    // Parse course and sem from existing class_name if any
    let matchedCourse = 'AIML';
    let matchedSem = 'Sem 1';
    for (const c of STUDENT_COURSES) {
      if (cls.toUpperCase().includes(c)) {
        matchedCourse = c;
        break;
      }
    }
    const semMatch = cls.match(/Sem\s*(\d+)/i);
    if (semMatch) {
      const semNum = parseInt(semMatch[1], 10);
      const maxSems = COURSE_CONFIG[matchedCourse]?.totalSem || 4;
      if (semNum <= maxSems) {
        matchedSem = `Sem ${semNum}`;
      }
    }
    setEditStudentCourse(matchedCourse);
    setEditStudentSem(matchedSem);
    setIsEditingPersonMeta(false);
  };

  const handleSavePersonMeta = async () => {
    if (!selectedPerson) return;
    const trimmedName = editPersonName.trim();
    if (!trimmedName) {
      showToast("Person name cannot be empty.", 'warning');
      return;
    }
    setSavingEditMeta(true);
    try {
      const payload = {
        name: trimmedName,
        category: editCategory,
        class_name: editCategory === 'STUDENT' ? editClass.trim() : '',
        department: editCategory !== 'STUDENT' ? editDept.trim() : '',
      };
      const res = await API.patch(`/persons/${selectedPerson.id}/`, payload);
      setSelectedPerson(res.data);
      setIsEditingPersonMeta(false);
      fetchPersons();
      showToast(`Updated "${res.data.name}" successfully`, 'success');
    } catch (err) {
      console.error("Failed to update person details", err);
      showToast("Failed to update details. Please try again.", 'error');
    } finally {
      setSavingEditMeta(false);
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

  const scanFilesFromDrop = async (items) => {
    const files = [];
    const traverse = (entry, path = '') => {
      return new Promise((resolve) => {
        if (!entry) {
          resolve();
          return;
        }
        if (entry.isFile) {
          entry.file((file) => {
            Object.defineProperty(file, 'webkitRelativePath', {
              value: (path ? path + '/' : '') + file.name,
              writable: true,
            });
            files.push(file);
            resolve();
          }, () => resolve());
        } else if (entry.isDirectory) {
          const dirReader = entry.createReader();
          const readEntries = () => {
            dirReader.readEntries((entries) => {
              if (!entries || entries.length === 0) {
                resolve();
              } else {
                Promise.all(entries.map((e) => traverse(e, (path ? path + '/' : '') + entry.name))).then(() => {
                  readEntries();
                });
              }
            }, () => resolve());
          };
          readEntries();
        } else {
          resolve();
        }
      });
    };

    const promises = [];
    for (let i = 0; i < items.length; i++) {
      const entry = items[i].webkitGetAsEntry ? items[i].webkitGetAsEntry() : null;
      if (entry) {
        promises.push(traverse(entry));
      }
    }
    await Promise.all(promises);
    return files;
  };

  const parsePersonGroups = (files) => {
    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) return [];

    const groupsMap = {};

    imageFiles.forEach(file => {
      let personName = '';
      const relPath = file.webkitRelativePath || '';
      if (relPath) {
        const parts = relPath.split('/').filter(Boolean);
        if (parts.length >= 2) {
          personName = parts[parts.length - 2];
        }
      }

      if (!personName) {
        personName = 'New Person';
      }

      personName = personName.replace(/[_\-]+/g, ' ').trim();

      if (!groupsMap[personName]) {
        groupsMap[personName] = {
          name: personName,
          files: [],
          previewUrl: URL.createObjectURL(file),
          class_name: batchClass,
          department: batchDept,
        };
      }
      groupsMap[personName].files.push(file);
    });

    return Object.values(groupsMap);
  };

  const handleDrop = async function (e) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    let droppedFiles = [];
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      try {
        droppedFiles = await scanFilesFromDrop(e.dataTransfer.items);
      } catch (err) {
        console.warn('Error reading dropped directory tree', err);
      }
    }
    if (!droppedFiles || droppedFiles.length === 0) {
      droppedFiles = Array.from(e.dataTransfer.files || []);
    }

    const imageFiles = droppedFiles.filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) return;

    const groups = parsePersonGroups(imageFiles);
    if (groups.length > 1) {
      setBatchGroups(groups);
      setShowAddPersonModal(false);
      setShowBatchModal(true);
    } else if (groups.length === 1 && groups[0].name !== 'New Person') {
      setNewPersonName(groups[0].name);
      setFilesToUpload(groups[0].files);
      const previews = [];
      groups[0].files.slice(0, 16).forEach(f => previews.push(URL.createObjectURL(f)));
      setPreviewImages(previews);
    } else {
      handleFiles(imageFiles);
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

  const handleFolderInputSelect = (e) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
    if (files.length === 0) {
      alert('No images found in the selected folder.');
      return;
    }

    const groups = parsePersonGroups(files);
    if (groups.length === 0) {
      alert('No person folders found.');
      return;
    }

    if (groups.length === 1) {
      setNewPersonName(groups[0].name);
      setFilesToUpload(groups[0].files);
      const previews = [];
      groups[0].files.slice(0, 16).forEach(f => previews.push(URL.createObjectURL(f)));
      setPreviewImages(previews);
      setShowAddPersonModal(true);
    } else {
      setBatchGroups(groups);
      setShowAddPersonModal(false);
      setShowBatchModal(true);
    }
    e.target.value = '';
  };

  const handleBatchCourseSelect = (course) => {
    setBatchCourse(course);
    const maxSems = COURSE_CONFIG[course]?.totalSem || 4;
    let sem = batchSem;
    const currentSemNum = parseInt(sem.replace(/\D/g, ''), 10) || 1;
    if (currentSemNum > maxSems) {
      sem = 'Sem 1';
      setBatchSem('Sem 1');
    }
    const newCls = `${course} - ${sem}`;
    setBatchClass(newCls);
    setBatchGroups(prev => prev.map(g => ({ ...g, class_name: newCls })));
  };

  const handleBatchSemSelect = (sem) => {
    setBatchSem(sem);
    const newCls = `${batchCourse} - ${sem}`;
    setBatchClass(newCls);
    setBatchGroups(prev => prev.map(g => ({ ...g, class_name: newCls })));
  };

  const handleUpdateGroupName = (index, newName) => {
    setBatchGroups(prev => prev.map((g, i) => i === index ? { ...g, name: newName } : g));
  };

  const handleRemoveBatchGroup = (index) => {
    setBatchGroups(prev => prev.filter((_, i) => i !== index));
  };

  const handleBatchUploadSubmit = async () => {
    if (batchGroups.length === 0) return;
    setBatchUploading(true);
    setBatchProgress({ current: 1, total: batchGroups.length, currentName: batchGroups[0].name });

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < batchGroups.length; i++) {
      const group = batchGroups[i];
      setBatchProgress({ current: i + 1, total: batchGroups.length, currentName: group.name });

      try {
        const formData = new FormData();
        formData.append('name', group.name.trim());
        formData.append('category', batchCategory);
        if (batchCategory === 'STUDENT') {
          const cls = group.class_name || batchClass;
          if (cls.trim()) formData.append('class_name', cls.trim());
        } else {
          const dept = group.department || batchDept;
          if (dept.trim()) formData.append('department', dept.trim());
        }
        group.files.forEach(file => formData.append('images', file));

        await API.post('/dataset/upload/', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        successCount++;
      } catch (err) {
        console.error(`Failed to upload ${group.name}`, err);
        failCount++;
      }
    }

    setBatchUploading(false);
    setShowBatchModal(false);
    setBatchGroups([]);
    fetchPersons();
    showToast(`Batch Upload Complete: ${successCount} people added successfully${failCount > 0 ? `, ${failCount} failed` : ''}.`, failCount > 0 ? 'warning' : 'success', 6000);
  };

  const handleAddPersonSubmit = async (e) => {
    e.preventDefault();
    if (!newPersonName || filesToUpload.length === 0) return;

    const personNameTrimmed = newPersonName.trim();
    const imageCount = filesToUpload.length;

    const formData = new FormData();
    formData.append('name', personNameTrimmed);
    formData.append('category', newPersonCategory);
    if (newPersonCategory === 'STUDENT') {
      if (newPersonClass.trim()) formData.append('class_name', newPersonClass.trim());
    } else {
      if (newPersonDept.trim()) formData.append('department', newPersonDept.trim());
    }
    filesToUpload.forEach(file => formData.append('images', file));

    // Show progress overlay
    setUploadProgress({ status: 'uploading', personName: personNameTrimmed, imageCount, embeddingsComputed: 0 });

    try {
      setUploadProgress({ status: 'computing', personName: personNameTrimmed, imageCount, embeddingsComputed: 0 });
      const response = await API.post('/dataset/upload/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const embCount = response.data?.embeddings_computed || 0;
      setUploadProgress({ status: 'done', personName: personNameTrimmed, imageCount, embeddingsComputed: embCount });

      // Brief pause to show completion state
      await new Promise(r => setTimeout(r, 600));
      setUploadProgress(null);

      setShowAddPersonModal(false);
      setNewPersonName('');
      setNewPersonCategory('STUDENT');
      setNewStudentCourse('AIML');
      setNewStudentSem('Sem 1');
      setNewPersonClass('AIML - Sem 1');
      setNewPersonDept('');
      setPreviewImages([]);
      setFilesToUpload([]);
      fetchPersons();
      showToast(`"${personNameTrimmed}" uploaded — ${imageCount} image${imageCount !== 1 ? 's' : ''}${embCount > 0 ? `, ${embCount} embeddings` : ''}`, 'success');
    } catch (error) {
      console.error("Failed to add person", error);
      setUploadProgress(null);
      showToast('Upload failed — ' + (error.response?.data?.error || 'try again'), 'error', 5000);
    }
  };

  const handleDeletePerson = async (id) => {
    const personName = selectedPerson?.name || 'Person';
    try {
      await API.delete(`/persons/${id}/`);
      setSelectedPerson(null);
      fetchPersons();
      showToast(`"${personName}" deleted`, 'deleted');
    } catch (error) {
      console.error("Failed to delete person", error);
      showToast(`Failed to delete "${personName}"`, 'error');
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
      showToast('Image deleted', 'deleted', 2500);
    } catch (error) {
      console.error("Failed to delete image", error);
      showToast('Failed to delete image', 'error');
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

    const fileCount = moreFiles.length;
    const formData = new FormData();
    formData.append('name', selectedPerson.name);
    moreFiles.forEach(file => formData.append('images', file));

    setUploadProgress({ status: 'computing', personName: selectedPerson.name, imageCount: fileCount, embeddingsComputed: 0 });

    try {
      const response = await API.post('/dataset/upload/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const embCount = response.data?.embeddings_computed || 0;
      setUploadProgress(null);
      setMoreFiles([]);
      if (uploadMoreInputRef.current) uploadMoreInputRef.current.value = '';
      fetchPersons();
      const res = await API.get(`/persons/${selectedPerson.id}/`);
      setSelectedPerson(res.data);
      showToast(`${fileCount} photo${fileCount !== 1 ? 's' : ''} added to "${selectedPerson.name}"`, 'success');
    } catch (error) {
      console.error("Failed to upload more images", error);
      setUploadProgress(null);
      showToast('Upload failed — try again', 'error');
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
            url: img.url ? getImageUrl(img.url) : ''
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
      showToast('Please enter a name for the person.', 'warning', 3500);
      return;
    }

    const filenames = group.images.map(img => img.filename);
    setRegisteringGroupId(groupId);

    const meta = groupMeta[groupId] || { category: 'STUDENT', class_name: 'AIML - Sem 1', department: '' };

    try {
      const response = await API.post('/dataset/assign/', {
        group_images: filenames,
        person_name: personName,
        category: meta.category || 'STUDENT',
        class_name: (meta.category || 'STUDENT') === 'STUDENT' ? (meta.class_name || 'AIML - Sem 1') : '',
        department: (meta.category || 'STUDENT') !== 'STUDENT' ? (meta.department || '') : ''
      });

      if (response.data && response.data.status === 'success') {
        setClassifiedGroups(prev => prev.filter(g => g.id !== groupId));
        setClassifiedGroupsChanged(true);
        fetchPersons();
        fetchUnknowns();
      } else {
        showToast(response.data?.message || 'Failed to register group.', 'error');
      }
    } catch (error) {
      console.error("Failed to assign group", error);
      showToast(error.response?.data?.message || 'Error occurred while registering group.', 'error');
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
      <section className="page-hero">
        <div className="page-hero-bg-wrapper">
          <div className="page-hero-bg"></div>
          <div className="page-hero-orb"></div>
        </div>

        <div className="container page-hero-content" style={{ zIndex: 2 }}>
          <div className="row align-items-center text-center text-md-start">
            <div className="col-md-8 mb-3 mb-md-0">
              <h1 className="dataset-title mb-2">
                Dataset <span className="accent">Directory</span>
              </h1>
              <p className="page-hero-sub mx-auto ms-md-0">Manage and organize
                person-specific training samples for the recognition model.</p>
            </div>
            <div className="col-md-4 text-center text-md-end d-flex gap-2 flex-shrink-0 justify-content-center justify-content-md-end align-items-center">
              <input type="file" ref={batchFolderInputRef} className="d-none" webkitdirectory="true" directory="true" multiple onChange={handleFolderInputSelect} />
              <input type="file" ref={bulkFolderInputRef} className="d-none" webkitdirectory="true" directory="true" multiple onChange={handleFolderInputSelect} />
              <button type="button" className="btn-ds-outline" onClick={() => batchFolderInputRef.current && batchFolderInputRef.current.click()} title="Import Multiple Person Folders at once">
                <i className="bi bi-folder-symlink-fill"></i> Batch Folders Import
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
            style={{ maxWidth: '420px' }}>
            <button type="button" className={`segment-btn flex-fill w-50 d-flex align-items-center justify-content-center rounded-pill border-0 transition-all fw-semibold ${activeTab === 'registered' ? 'active' : ''}`}
              onClick={() => setActiveTab('registered')}>
              <i className="bi bi-folder-check me-2 flex-shrink-0"></i>
              <span className="text-truncate">Registered People</span>
            </button>
            <button type="button" className={`segment-btn flex-fill w-50 d-flex align-items-center justify-content-center rounded-pill border-0 transition-all fw-semibold ${activeTab === 'unknowns' ? 'active' : ''}`}
              onClick={() => setActiveTab('unknowns')}>
              <i className="bi bi-shield-exclamation me-2 flex-shrink-0"></i>
              <span className="text-truncate">Unknown Captures</span>
            </button>
          </div>
        </div>

        {/* Registered View Container */}
        {activeTab === 'registered' && (
          <div id="registered-view">
            {/* Unified Filter & Search Toolbar */}
            <div className="ds-control-toolbar mb-4">
              {/* Row 1: Search Bar with Clear Button */}
              <div className="d-flex align-items-center gap-3">
                <div className="position-relative flex-grow-1">
                  <i className="bi bi-search position-absolute top-50 start-0 translate-middle-y ms-3 text-secondary" style={{ fontSize: '0.85rem' }}></i>
                  <input
                    type="text"
                    className="form-control form-control-sm rounded-pill ps-5 pe-4 py-2"
                    placeholder="Search personnel by name, course, semester, department..."
                    value={personSearchQuery}
                    onChange={(e) => setPersonSearchQuery(e.target.value)}
                    style={{
                      background: 'var(--bg-input, #1e293b)',
                      border: '1px solid var(--border-color, rgba(255, 255, 255, 0.14))',
                      fontSize: '0.82rem',
                      color: 'var(--text-heading, #f8fafc)',
                      boxShadow: 'none'
                    }}
                  />
                  {personSearchQuery && (
                    <button
                      type="button"
                      className="btn btn-sm position-absolute top-50 end-0 translate-middle-y me-2 p-0 text-secondary border-0"
                      style={{ width: '22px', height: '22px', lineHeight: 1 }}
                      onClick={() => setPersonSearchQuery('')}
                      title="Clear search"
                    >
                      <i className="bi bi-x-circle-fill"></i>
                    </button>
                  )}
                </div>
              </div>

              {/* Row 2: Category Filter Bar - Single clean horizontal scroll track so it NEVER breaks into 3 ragged rows */}
              <div className="ds-filter-row d-flex align-items-center gap-2">
                <span className="ds-filter-label text-uppercase">
                  <i className="bi bi-people-fill text-primary"></i> Role:
                </span>
                <div className="ds-filter-scroll-track d-flex align-items-center gap-2 flex-grow-1">
                  {CATEGORIES.map(cat => {
                    const count = cat.key === 'ALL'
                      ? persons.length
                      : persons.filter(p => (p.category || 'STUDENT') === cat.key).length;
                    const isActive = selectedCategory === cat.key;
                    return (
                      <button
                        key={cat.key}
                        type="button"
                        className={`ds-pill-btn ${isActive ? 'active' : ''}`}
                        onClick={() => {
                          setSelectedCategory(cat.key);
                          setSelectedCourse('ALL');
                          setSelectedSem('ALL');
                        }}
                      >
                        <i className={`bi ${cat.icon}`}></i>
                        <span>{cat.label}</span>
                        <span className={`ds-pill-badge ${isActive ? 'active' : ''}`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Row 3: Course Filter Bar (shown if 'ALL' or 'STUDENT' is selected) */}
              {(selectedCategory === 'ALL' || selectedCategory === 'STUDENT') && availableClasses.length > 0 && (
                <div className="ds-filter-row d-flex align-items-center gap-2 pt-2 border-top border-white border-opacity-10">
                  <span className="ds-filter-label text-uppercase">
                    <i className="bi bi-mortarboard-fill text-primary"></i> Course:
                  </span>
                  <div className="ds-filter-scroll-track d-flex align-items-center gap-2 flex-grow-1">
                    <button
                      type="button"
                      className={`ds-pill-btn ${selectedCourse === 'ALL' ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedCourse('ALL');
                        setSelectedSem('ALL');
                      }}
                    >
                      <span>All Courses</span>
                    </button>
                    {availableClasses.map(courseKey => {
                      const isConfigCourse = COURSE_CONFIG[courseKey];
                      const clsCount = courseKey === 'Unassigned'
                        ? persons.filter(p => (p.category || 'STUDENT') === 'STUDENT' && (!p.class_name || !p.class_name.trim())).length
                        : persons.filter(p => (p.category || 'STUDENT') === 'STUDENT' && (p.class_name || '').toUpperCase().includes(courseKey.toUpperCase())).length;
                      const isSelected = selectedCourse === courseKey;
                      return (
                        <button
                          key={courseKey}
                          type="button"
                          className={`ds-pill-btn ${isSelected ? 'active' : ''}`}
                          onClick={() => {
                            setSelectedCourse(courseKey);
                            setSelectedSem('ALL');
                          }}
                        >
                          {isConfigCourse && <i className={`bi ${isConfigCourse.icon}`}></i>}
                          <span>{courseKey}</span>
                          <span className={`ds-pill-badge ${isSelected ? 'active' : ''}`}>
                            {clsCount}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Row 4: Semester Sub-Filter Pills (shown if a specific COURSE_CONFIG course is selected) */}
              {(selectedCategory === 'ALL' || selectedCategory === 'STUDENT') && COURSE_CONFIG[selectedCourse] && (
                <div className="ds-filter-row d-flex align-items-center gap-2 pt-2 border-top border-white border-opacity-10">
                  <span className="ds-filter-label text-uppercase">
                    <i className="bi bi-calendar2-range-fill text-primary"></i> Sem:
                  </span>
                  <div className="ds-filter-scroll-track d-flex align-items-center gap-2 flex-grow-1">
                    <button
                      type="button"
                      className={`ds-pill-btn ${selectedSem === 'ALL' ? 'active' : ''}`}
                      onClick={() => setSelectedSem('ALL')}
                    >
                      <span>All Semesters</span>
                    </button>
                    {getCourseSemesters(selectedCourse).map(sem => {
                      const semCount = persons.filter(p => {
                        if ((p.category || 'STUDENT') !== 'STUDENT') return false;
                        return matchesCourseAndSem(p.class_name, selectedCourse, sem);
                      }).length;
                      const isSemActive = selectedSem === sem;
                      return (
                        <button
                          key={sem}
                          type="button"
                          className={`ds-pill-btn ${isSemActive ? 'active' : ''}`}
                          onClick={() => setSelectedSem(sem)}
                        >
                          <span>{sem}</span>
                          <span className={`ds-pill-badge ${isSemActive ? 'active' : ''}`}>
                            {semCount}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {filteredPersons.length > 0 ? (
              <div className="row row-cols-2 row-cols-md-3 row-cols-lg-4 g-3 g-md-4">
                {filteredPersons.map((person) => {
                  const badge = getCategoryBadge(person.category, person.class_name, person.department);
                  return (
                    <div className="col" key={person.id} data-reveal="true" data-reveal-delay="0">
                      <div
                        className="folder-card folder-card-blue p-3 p-md-4 rounded-4 h-100 position-relative overflow-hidden d-flex flex-column justify-content-between"
                        onClick={() => openPersonDetail(person)}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="folder-glow"></div>
                        <div>
                          <div className="d-flex justify-content-between align-items-center mb-2.5">
                            <div className="folder-icon-wrapper">
                              <i className="bi bi-folder-fill text-primary" style={{ fontSize: '1.25rem' }}></i>
                            </div>
                            <span
                              className="badge rounded-pill px-3 py-1 fw-bold d-inline-flex align-items-center text-nowrap"
                              style={{
                                fontSize: '0.74rem',
                                background: 'rgba(37, 99, 235, 0.16)',
                                color: '#60a5fa',
                                border: '1px solid rgba(37, 99, 235, 0.35)',
                                gap: '5px'
                              }}
                            >
                              <i className="bi bi-images" style={{ fontSize: '0.72rem' }}></i>
                              <span>{(person.images || []).length} Photos</span>
                            </span>
                          </div>
                          <div className="my-auto py-1">
                            <h5 className="fw-bold text-heading mb-2 text-capitalize text-truncate" style={{ fontSize: '1.15rem', lineHeight: 1.3 }}>
                              {person.name}
                            </h5>
                            {/* Role / Class Badge */}
                            <span
                              className="badge rounded-pill px-2.5 py-1 fw-semibold d-inline-flex align-items-center"
                              style={{
                                background: badge.bg,
                                color: badge.color,
                                border: `1px solid ${badge.border}`,
                                fontSize: '0.72rem',
                                maxWidth: '100%',
                                gap: '6px'
                              }}
                            >
                              <i className={`bi ${badge.icon} flex-shrink-0`} style={{ marginRight: '5px', fontSize: '0.78rem' }}></i>
                              <span className="text-truncate">{badge.label}</span>
                            </span>
                          </div>
                          <div className="pt-2 mt-2 border-top border-white border-opacity-10">
                            <p className="text-secondary small mb-0 d-flex align-items-center" style={{ fontSize: '0.74rem' }}>
                              <i className="bi bi-calendar3 text-primary flex-shrink-0 me-2"></i>
                              <span className="text-truncate font-mono">{person.created_at}</span>
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : persons.length > 0 ? (
              <div className="d-flex flex-column align-items-center justify-content-center text-center py-5 w-100" style={{ minHeight: '35vh' }}>
                <div className="empty-state-icon mb-3">
                  <i className="bi bi-filter-circle text-secondary opacity-25 display-3"></i>
                </div>
                <h4 className="text-dynamic fw-bold">No Personnel Match Filter</h4>
                <p className="text-secondary mx-auto mb-3" style={{ maxWidth: '420px' }}>
                  No profiles found under <strong>{CATEGORIES.find(c => c.key === selectedCategory)?.label || selectedCategory}</strong>
                  {selectedCourse !== 'ALL' && ` • ${selectedCourse}`}
                  {selectedSem !== 'ALL' && ` (${selectedSem})`}.
                </p>
                <button
                  className="btn btn-outline-primary btn-sm rounded-pill px-4"
                  onClick={() => {
                    setSelectedCategory('ALL');
                    setSelectedCourse('ALL');
                    setSelectedSem('ALL');
                    setPersonSearchQuery('');
                  }}
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              <div className="d-flex flex-column align-items-center justify-content-center text-center py-5 w-100" style={{ minHeight: '50vh' }}>
                <div className="empty-state-icon mb-4">
                  <i className="bi bi-folder-x text-secondary opacity-25 display-1"></i>
                </div>
                <h3 className="text-dynamic fw-bold">Dataset Is Empty</h3>
                <p className="text-secondary mx-auto mb-4" style={{ maxWidth: '400px' }}>
                  No face profiles have been registered yet. Start building your Smart Sight database by adding a new person.
                </p>
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
          <div className="modal-backdrop fade show modern-backdrop" style={{ opacity: 0.7, }}></div>
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
                    {/* Person Identification */}
                    <div className="mb-3">
                      <label className="form-label text-heading small text-uppercase fw-800 letter-spacing-wide mb-2">Person Identification</label>
                      <div className="form-floating custom-form-floating">
                        <input type="text" className="form-control rounded-pill px-4" placeholder="Enter person name" value={newPersonName} onChange={e => setNewPersonName(e.target.value)} required />
                        <label className="ps-4">Full Name</label>
                      </div>
                    </div>

                    {/* Institutional Category Selector */}
                    <div className="mb-3">
                      <label className="form-label text-heading small text-uppercase fw-800 letter-spacing-wide mb-2">Category / Role</label>
                      <div className="row row-cols-2 row-cols-sm-3 g-2">
                        {CATEGORIES.filter(c => c.key !== 'ALL').map(cat => {
                          const isSel = newPersonCategory === cat.key;
                          return (
                            <div className="col" key={cat.key}>
                              <button
                                type="button"
                                className={`btn w-100 py-2.5 px-2 rounded-4 text-center d-flex flex-column align-items-center justify-content-center gap-1 transition-all ${
                                  isSel
                                    ? 'btn-primary shadow-sm border-primary'
                                    : 'btn-outline-secondary text-heading border-secondary border-opacity-25'
                                }`}
                                onClick={() => setNewPersonCategory(cat.key)}
                              >
                                <i className={`bi ${cat.icon} fs-5`}></i>
                                <span className="small fw-bold">{cat.label}</span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Conditional Fields based on Category */}
                    {newPersonCategory === 'STUDENT' ? (
                      <div className="mb-3 p-3 rounded-4" style={{ background: 'var(--bg-surface-solid, rgba(255,255,255,0.03))', border: '1px solid var(--border-color, rgba(255,255,255,0.08))' }}>
                        <label className="form-label text-heading small text-uppercase fw-800 letter-spacing-wide mb-2 d-flex justify-content-between align-items-center">
                          <span><i className="bi bi-mortarboard-fill text-primary me-1"></i> Course</span>
                          <span className="badge rounded-pill bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25" style={{ fontSize: '0.72rem' }}>
                            {newPersonClass || 'Select Course & Sem'}
                          </span>
                        </label>

                        {/* Course Selection Cards */}
                        <div className="row g-2 mb-3">
                          {Object.entries(COURSE_CONFIG).map(([cKey, cfg]) => {
                            const isSelected = newStudentCourse === cKey;
                            return (
                              <div className="col-6 col-sm-3" key={cKey}>
                                <button
                                  type="button"
                                  className={`btn w-100 py-2.5 px-2 rounded-3 text-center d-flex flex-column align-items-center justify-content-center gap-1 transition-all ${
                                    isSelected
                                      ? 'btn-primary shadow-sm border-primary'
                                      : 'btn-outline-secondary text-heading border-secondary border-opacity-25'
                                  }`}
                                  onClick={() => handleAddPersonCourseSelect(cKey)}
                                >
                                  <div className="d-flex align-items-center justify-content-center gap-2 fw-bold" style={{ fontSize: '0.85rem' }}>
                                    <i className={`bi ${cfg.icon}`}></i>
                                    <span>{cfg.label}</span>
                                  </div>
                                  <span className="small opacity-75" style={{ fontSize: '0.68rem', lineHeight: '1.2' }}>
                                    {cfg.duration} • {cfg.totalSem} Sem
                                  </span>
                                </button>
                              </div>
                            );
                          })}
                        </div>

                        {/* Dynamic Semester Selection Pills */}
                        <div className="mb-3">
                          <div className="d-flex align-items-center justify-content-between mb-1.5">
                            <span className="small text-secondary fw-bold text-uppercase" style={{ fontSize: '0.7rem', letterSpacing: '0.5px' }}>
                              <i className="bi bi-calendar2-range-fill text-primary me-1"></i> {newStudentCourse} Semester ({COURSE_CONFIG[newStudentCourse]?.totalSem || 0} Available):
                            </span>
                            <span className="text-secondary small" style={{ fontSize: '0.72rem' }}>Click semester pill</span>
                          </div>
                          <div className="d-flex flex-wrap gap-2">
                            {getCourseSemesters(newStudentCourse).map(sem => {
                              const isSemActive = newStudentSem === sem;
                              return (
                                <button
                                  key={sem}
                                  type="button"
                                  className={`btn btn-sm rounded-pill px-3 py-1 fw-bold transition-all ${
                                    isSemActive
                                      ? 'btn-primary shadow-sm'
                                      : 'btn-outline-secondary border-secondary border-opacity-25 text-heading'
                                  }`}
                                  style={{ fontSize: '0.75rem' }}
                                  onClick={() => handleAddPersonSemSelect(sem)}
                                >
                                  {sem}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Class Display & Manual Override Input */}
                        <div className="form-floating custom-form-floating">
                          <input
                            type="text"
                            list="known-classes-add-list"
                            className="form-control rounded-pill px-4"
                            placeholder="e.g. AIML - Sem 1"
                            value={newPersonClass}
                            onChange={e => setNewPersonClass(e.target.value)}
                          />
                          <datalist id="known-classes-add-list">
                            {availableClasses.filter(c => c !== 'Unassigned').map(c => (
                              <option key={c} value={c} />
                            ))}
                          </datalist>
                          <label className="ps-4">Class / Section Label (Auto-generated or customize)</label>
                        </div>
                      </div>
                    ) : (
                      <div className="mb-3">
                        <label className="form-label text-heading small text-uppercase fw-800 letter-spacing-wide mb-1">Department / Lab / Area</label>
                        <div className="form-floating custom-form-floating">
                          <input
                            type="text"
                            className="form-control rounded-pill px-4"
                            placeholder="e.g. Computer Science, Admin Office, AI Lab"
                            value={newPersonDept}
                            onChange={e => setNewPersonDept(e.target.value)}
                          />
                          <label className="ps-4">Department / Office / Lab (Optional)</label>
                        </div>
                      </div>
                    )}

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
                          <button type="button" className="btn btn-secondary btn-sm rounded-pill px-3 py-1.5" onClick={() => fileInputRef.current && fileInputRef.current.click()}>
                            <i className="bi bi-images me-1.5 text-primary"></i> Select Files
                          </button>
                          <button type="button" className="btn btn-secondary btn-sm rounded-pill px-3 py-1.5" onClick={() => bulkFolderInputRef.current && bulkFolderInputRef.current.click()}>
                            <i className="bi bi-folder-plus me-1.5 text-primary"></i> Select Single Folder
                          </button>
                          <button type="button" className="btn btn-primary btn-sm rounded-pill px-3.5 py-1.5 shadow-sm fw-bold" onClick={() => batchFolderInputRef.current && batchFolderInputRef.current.click()}>
                            <i className="bi bi-folder-symlink-fill me-1.5"></i> Upload Multiple Folders
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
                  <div className="modal-footer border-0 p-4 pt-0 d-flex flex-column gap-2">
                    {/* In-modal progress bar when uploading */}
                    {uploadProgress && (
                      <div className="w-100 p-3 rounded-4 mb-1" style={{ background: 'rgba(37, 99, 235, 0.08)', border: '1px solid rgba(37, 99, 235, 0.25)' }}>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <span className="small fw-bold text-heading d-flex align-items-center gap-2">
                            {uploadProgress.status === 'done' ? (
                              <i className="bi bi-check-circle-fill text-success"></i>
                            ) : (
                              <span className="spinner-border spinner-border-sm text-primary" role="status"></span>
                            )}
                            {uploadProgress.status === 'uploading' && 'Uploading Images...'}
                            {uploadProgress.status === 'computing' && 'Computing Facial Embeddings...'}
                            {uploadProgress.status === 'done' && 'Complete!'}
                          </span>
                          <span className="small font-mono fw-bold text-primary">
                            {uploadProgress.imageCount} image{uploadProgress.imageCount !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="progress" style={{ height: '6px', background: 'rgba(255,255,255,0.08)' }}>
                          <div
                            className={`progress-bar ${uploadProgress.status === 'done' ? 'bg-success' : 'progress-bar-striped progress-bar-animated bg-primary'}`}
                            style={{ width: '100%' }}
                          ></div>
                        </div>
                        {uploadProgress.status === 'computing' && (
                          <span className="small text-secondary d-block mt-1.5" style={{ fontSize: '0.7rem' }}>
                            <i className="bi bi-cpu-fill text-primary me-1"></i>
                            Processing ArcFace 512-d embeddings for each uploaded face...
                          </span>
                        )}
                      </div>
                    )}
                    <div className="d-flex gap-2 w-100">
                      <button type="button" className="btn btn-cancel-red rounded-pill px-4 flex-grow-1" disabled={!!uploadProgress} onClick={() => {
                        setShowAddPersonModal(false);
                        setPreviewImages([]);
                        setFilesToUpload([]);
                        setNewPersonName('');
                        setNewStudentCourse('AIML');
                        setNewStudentSem('Sem 1');
                        setNewPersonClass('AIML - Sem 1');
                      }}>Cancel</button>
                      <button type="submit" className="btn btn-primary px-5 rounded-pill fw-bold flex-grow-1 d-flex align-items-center justify-content-center gap-2" disabled={!!uploadProgress}>
                        {uploadProgress ? (
                          <>
                            <span className="spinner-border spinner-border-sm" role="status"></span>
                            <span>Processing...</span>
                          </>
                        ) : (
                          'Initialize Folder'
                        )}
                      </button>
                    </div>
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
          <div className="modal-backdrop fade show modern-backdrop" style={{ opacity: 0.7, zIndex: 10540 }} onClick={() => setSelectedPerson(null)}></div>
          <div className="modal fade show d-block" tabIndex="-1" aria-hidden="true" onClick={() => setSelectedPerson(null)} style={{ zIndex: 10550 }}>
            <div className="modal-dialog modal-xl modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
              <div className="modal-content overflow-hidden shadow-2xl border-0">
                <div className="modal-header border-0 p-4 pb-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
                  <div className="d-flex align-items-center flex-grow-1 min-w-0">
                    <div className="bg-primary bg-opacity-10 rounded-4 me-3 border border-primary border-opacity-10 flex-shrink-0 d-flex align-items-center justify-content-center" style={{ width: '48px', height: '48px' }}>
                      <i className="bi bi-folder-fill text-primary fs-4"></i>
                    </div>
                    <div className="flex-grow-1 min-w-0">
                      <div className="d-flex align-items-center gap-2 flex-wrap">
                        <h4 className="modal-title fw-bold text-heading text-capitalize mb-0" style={{ lineHeight: 1.2 }}>{selectedPerson.name}</h4>
                        {(() => {
                          const badge = getCategoryBadge(selectedPerson.category, selectedPerson.class_name, selectedPerson.department);
                          return (
                            <span
                              className="badge rounded-pill px-2.5 py-1 fw-semibold d-inline-flex align-items-center gap-1.5"
                              style={{
                                background: badge.bg,
                                color: badge.color,
                                border: `1px solid ${badge.border}`,
                                fontSize: '0.74rem',
                              }}
                            >
                              <i className={`bi ${badge.icon}`}></i>
                              <span>{badge.label}</span>
                            </span>
                          );
                        })()}
                        {!isEditingPersonMeta && (
                          <button
                            type="button"
                            className="btn btn-outline-secondary btn-sm rounded-pill px-2.5 py-0.5 d-inline-flex align-items-center gap-1.5 border-secondary border-opacity-25"
                            style={{ fontSize: '0.74rem' }}
                            onClick={() => {
                              setEditPersonName(selectedPerson.name || '');
                              setEditCategory(selectedPerson.category || 'STUDENT');
                              setEditClass(selectedPerson.class_name || '');
                              setEditDept(selectedPerson.department || '');
                              setIsEditingPersonMeta(true);
                            }}
                            title="Edit Name, Category or Class"
                          >
                            <i className="bi bi-pencil-fill" style={{ fontSize: '0.68rem' }}></i>
                            <span>Edit Details</span>
                          </button>
                        )}
                      </div>

                      {/* Inline Role & Class Editor */}
                      {isEditingPersonMeta ? (
                        <div className="d-flex flex-column gap-2.5 mt-2 w-100 p-3 rounded-4" style={{ background: 'var(--bg-surface-solid, rgba(255,255,255,0.04))', border: '1px solid var(--border-color, rgba(255,255,255,0.12))' }}>
                          <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 pb-1 border-bottom border-white border-opacity-10">
                            <span className="small fw-bold text-heading text-uppercase letter-spacing-wide d-flex align-items-center gap-1.5" style={{ fontSize: '0.74rem' }}>
                              <i className="bi bi-pencil-square text-primary"></i> Edit Person Details
                            </span>
                            <div className="d-flex align-items-center gap-2">
                              <span className="small text-secondary fw-bold text-uppercase" style={{ fontSize: '0.7rem' }}>Role:</span>
                              <select
                                className="form-select form-select-sm rounded-pill px-3 py-1"
                                style={{ width: 'auto', fontSize: '0.78rem', background: 'var(--bg-input, #0f172a)', color: 'var(--text-heading, #fff)' }}
                                value={editCategory}
                                onChange={e => setEditCategory(e.target.value)}
                              >
                                {CATEGORIES.filter(c => c.key !== 'ALL').map(c => (
                                  <option key={c.key} value={c.key}>{c.label}</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {/* Full Name Edit Input */}
                          <div className="d-flex align-items-center gap-2">
                            <span className="small text-secondary fw-bold text-uppercase" style={{ fontSize: '0.7rem', minWidth: '70px' }}>
                              Name:
                            </span>
                            <input
                              type="text"
                              className="form-control form-control-sm rounded-pill px-3 py-1 flex-grow-1"
                              style={{ maxWidth: '340px', fontSize: '0.82rem', background: 'var(--bg-input, #0f172a)', color: 'var(--text-heading, #fff)' }}
                              placeholder="Full Name..."
                              value={editPersonName}
                              onChange={e => setEditPersonName(e.target.value)}
                              required
                            />
                          </div>

                          {editCategory === 'STUDENT' ? (
                            <div className="d-flex flex-column gap-2">
                              {/* Course Pills */}
                              <div className="d-flex flex-wrap gap-1.5 align-items-center">
                                <span className="small text-secondary fw-bold text-uppercase me-1" style={{ fontSize: '0.7rem' }}>Course:</span>
                                {Object.entries(COURSE_CONFIG).map(([cKey, cfg]) => (
                                  <button
                                    key={cKey}
                                    type="button"
                                    className={`btn btn-sm rounded-pill px-2.5 py-0.5 fw-bold transition-all ${
                                      editStudentCourse === cKey
                                        ? 'btn-primary shadow-sm'
                                        : 'btn-outline-secondary text-heading border-secondary border-opacity-25'
                                    }`}
                                    style={{ fontSize: '0.72rem' }}
                                    onClick={() => handleEditCourseSelect(cKey)}
                                  >
                                    <i className={`bi ${cfg.icon} me-1`}></i>
                                    {cKey} ({cfg.duration})
                                  </button>
                                ))}
                              </div>

                              {/* Dynamic Semester Pills */}
                              <div className="d-flex flex-wrap gap-1 align-items-center">
                                <span className="small text-secondary fw-bold text-uppercase me-1" style={{ fontSize: '0.7rem' }}>{editStudentCourse} Sem ({COURSE_CONFIG[editStudentCourse]?.totalSem || 0} Sems):</span>
                                {getCourseSemesters(editStudentCourse).map(sem => (
                                  <button
                                    key={sem}
                                    type="button"
                                    className={`btn btn-sm rounded-pill px-2 py-0.5 fw-bold transition-all ${
                                      editStudentSem === sem
                                        ? 'btn-primary shadow-sm'
                                        : 'btn-outline-secondary text-heading border-secondary border-opacity-25'
                                    }`}
                                    style={{ fontSize: '0.7rem' }}
                                    onClick={() => handleEditSemSelect(sem)}
                                  >
                                    {sem}
                                  </button>
                                ))}
                              </div>

                              {/* Custom input and action buttons */}
                              <div className="d-flex gap-2 align-items-center flex-wrap mt-1">
                                <input
                                  type="text"
                                  list="known-classes-modal-list"
                                  className="form-control form-control-sm rounded-pill px-3 py-1 flex-grow-1"
                                  style={{ minWidth: '180px', maxWidth: '320px', fontSize: '0.78rem', background: 'var(--bg-input, #0f172a)', color: 'var(--text-heading, #fff)' }}
                                  placeholder="Class / Sem..."
                                  value={editClass}
                                  onChange={e => setEditClass(e.target.value)}
                                />
                                <datalist id="known-classes-modal-list">
                                  {availableClasses.filter(c => c !== 'Unassigned').map(c => (
                                    <option key={c} value={c} />
                                  ))}
                                </datalist>

                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm rounded-pill px-3 py-1 fw-bold ms-auto"
                                  style={{ fontSize: '0.76rem' }}
                                  disabled={savingEditMeta}
                                  onClick={handleSavePersonMeta}
                                >
                                  {savingEditMeta ? 'Saving...' : 'Save Changes'}
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-outline-secondary btn-sm rounded-pill px-2.5 py-1"
                                  style={{ fontSize: '0.76rem' }}
                                  onClick={() => setIsEditingPersonMeta(false)}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="d-flex gap-2 align-items-center flex-wrap">
                              <input
                                type="text"
                                className="form-control form-control-sm rounded-pill px-3 py-1 flex-grow-1"
                                style={{ minWidth: '180px', maxWidth: '320px', fontSize: '0.78rem', background: 'var(--bg-input, #0f172a)', color: 'var(--text-heading, #fff)' }}
                                placeholder="Department / Lab / Area..."
                                value={editDept}
                                onChange={e => setEditDept(e.target.value)}
                              />
                              <button
                                type="button"
                                className="btn btn-primary btn-sm rounded-pill px-3 py-1 fw-bold ms-auto"
                                style={{ fontSize: '0.76rem' }}
                                disabled={savingEditMeta}
                                onClick={handleSavePersonMeta}
                              >
                                {savingEditMeta ? 'Saving...' : 'Save'}
                              </button>
                              <button
                                type="button"
                                className="btn btn-outline-secondary btn-sm rounded-pill px-2.5 py-1"
                                style={{ fontSize: '0.76rem' }}
                                onClick={() => setIsEditingPersonMeta(false)}
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-secondary small d-flex align-items-center gap-2 mt-1">
                          <i className="bi bi-shield-check text-success flex-shrink-0 me-1"></i>
                          <span className="text-nowrap fw-semibold">{selectedPerson.images.length} Images</span>
                        </div>
                      )}
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
                <div className="modal-footer border-0 p-3 d-flex flex-column gap-0" style={{ background: 'var(--bg-surface-solid, #111827)', borderTop: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))' }}>
                  {/* Progress bar when uploading more photos */}
                  {uploadProgress && (
                    <div className="w-100 p-3 rounded-4 mb-2" style={{ background: 'rgba(37, 99, 235, 0.08)', border: '1px solid rgba(37, 99, 235, 0.25)' }}>
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <span className="small fw-bold text-heading d-flex align-items-center gap-2">
                          {uploadProgress.status === 'done' ? (
                            <i className="bi bi-check-circle-fill text-success"></i>
                          ) : (
                            <span className="spinner-border spinner-border-sm text-primary" role="status"></span>
                          )}
                          {uploadProgress.status === 'computing' && 'Computing Embeddings...'}
                          {uploadProgress.status === 'done' && 'Complete!'}
                        </span>
                        <span className="small font-mono fw-bold text-primary">
                          {uploadProgress.imageCount} image{uploadProgress.imageCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="progress" style={{ height: '6px', background: 'rgba(255,255,255,0.08)' }}>
                        <div
                          className={`progress-bar ${uploadProgress.status === 'done' ? 'bg-success' : 'progress-bar-striped progress-bar-animated bg-primary'}`}
                          style={{ width: '100%' }}
                        ></div>
                      </div>
                    </div>
                  )}
                  <form className="w-100 d-flex flex-column gap-2" onSubmit={handleUploadMore}>
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
                        background: 'var(--bg-input, rgba(255, 255, 255, 0.04))',
                        border: '1px solid var(--border-color, rgba(255, 255, 255, 0.12))',
                        minHeight: '48px',
                      }}>
                      <button
                        type="button"
                        className="btn btn-primary rounded-pill px-3.5 py-1.5 text-nowrap d-flex align-items-center gap-2 shadow-sm flex-shrink-0"
                        disabled={!!uploadProgress}
                        onClick={() => uploadMoreInputRef.current && uploadMoreInputRef.current.click()}
                        style={{ fontSize: '0.85rem' }}
                      >
                        <i className="bi bi-images fs-6"></i>
                        <span className="fw-bold">Choose Photos</span>
                      </button>

                      <div className="pe-3 ps-1 d-flex align-items-center gap-2 min-w-0 flex-grow-1 justify-content-end text-end">
                        <i className={`bi ${moreFiles.length > 0 ? 'bi-check-circle-fill text-success' : 'bi-info-circle text-muted'}`} style={{ fontSize: '0.9rem' }}></i>
                        <span className="small text-heading text-truncate font-mono fw-semibold" style={{ fontSize: '0.8rem' }}>
                          {moreFiles.length > 0
                            ? `${moreFiles.length} photo${moreFiles.length > 1 ? 's' : ''}`
                            : 'No new photos'}
                        </span>
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="btn btn-primary rounded-pill py-2 w-100 text-nowrap d-flex align-items-center justify-content-center gap-2 shadow-sm"
                      disabled={moreFiles.length === 0 || !!uploadProgress}
                      style={{
                        opacity: (moreFiles.length === 0 || uploadProgress) ? 0.45 : 1,
                        cursor: (moreFiles.length === 0 || uploadProgress) ? 'not-allowed' : 'pointer',
                        transition: 'all 0.3s ease',
                        fontSize: '0.88rem',
                        fontWeight: 700,
                        minHeight: '42px'
                      }}
                    >
                      {uploadProgress ? (
                        <>
                          <span className="spinner-border spinner-border-sm" role="status"></span>
                          <span>Processing...</span>
                        </>
                      ) : (
                        <>
                          <i className="bi bi-cloud-arrow-up-fill fs-5"></i>
                          <span>{moreFiles.length > 0 ? `Upload ${moreFiles.length} Photo${moreFiles.length > 1 ? 's' : ''}` : 'Upload More'}</span>
                        </>
                      )}
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
          <div className="modal-backdrop fade show modern-backdrop" style={{ opacity: 0.7, }}></div>
          <div className="modal fade show d-block" tabIndex="-1" aria-hidden="true">
            <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
              <div className="modal-content overflow-hidden"
                style={{ background: 'var(--modal-bg)', border: '1px solid var(--modal-border)', borderRadius: '24px', }}>
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
          <div className="modal-backdrop fade show modern-backdrop" style={{ opacity: 0.7, }}></div>
          <div className="modal fade show d-block" tabIndex="-1" data-bs-backdrop="static" aria-hidden="true">
            <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
              <div className="modal-content overflow-hidden"
                style={{ background: 'var(--modal-bg)', border: '1px solid var(--modal-border)', borderRadius: '24px', }}>
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
                              <div key={group.id} className="classify-group-card p-4 rounded-4 position-relative border border-secondary border-opacity-25" style={{ background: 'var(--bg-surface-solid)', }}>
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

                                <div className="d-flex flex-column gap-2 mb-2">
                                  <div className="d-flex flex-wrap gap-2 align-items-center">
                                    <span className="small text-secondary fw-bold" style={{ fontSize: '0.72rem' }}>Role:</span>
                                    <select
                                      className="form-select form-select-sm rounded-pill px-3 py-1"
                                      style={{ width: 'auto', fontSize: '0.78rem', background: 'var(--bg-input, #0f172a)', color: 'var(--text-heading, #fff)' }}
                                      value={groupMeta[group.id]?.category || 'STUDENT'}
                                      onChange={e => {
                                        const cat = e.target.value;
                                        setGroupMeta(prev => ({
                                          ...prev,
                                          [group.id]: {
                                            ...prev[group.id],
                                            category: cat,
                                            class_name: cat === 'STUDENT' ? (prev[group.id]?.class_name || 'AIML - Sem 1') : '',
                                            department: cat !== 'STUDENT' ? (prev[group.id]?.department || '') : ''
                                          }
                                        }));
                                      }}
                                    >
                                      {CATEGORIES.filter(c => c.key !== 'ALL').map(c => (
                                        <option key={c.key} value={c.key}>{c.label}</option>
                                      ))}
                                    </select>

                                    {(groupMeta[group.id]?.category || 'STUDENT') === 'STUDENT' ? (
                                      <input
                                        type="text"
                                        list="known-classes-add-list"
                                        className="form-control form-control-sm rounded-pill px-3 py-1"
                                        style={{ width: '180px', fontSize: '0.78rem', background: 'var(--bg-input, #0f172a)', color: 'var(--text-heading, #fff)' }}
                                        placeholder="Course & Sem..."
                                        value={groupMeta[group.id]?.class_name ?? 'AIML - Sem 1'}
                                        onChange={e => {
                                          const val = e.target.value;
                                          setGroupMeta(prev => ({
                                            ...prev,
                                            [group.id]: {
                                              ...prev[group.id],
                                              category: 'STUDENT',
                                              class_name: val
                                            }
                                          }));
                                        }}
                                      />
                                    ) : (
                                      <input
                                        type="text"
                                        className="form-control form-control-sm rounded-pill px-3 py-1"
                                        style={{ width: '180px', fontSize: '0.78rem', background: 'var(--bg-input, #0f172a)', color: 'var(--text-heading, #fff)' }}
                                        placeholder="Department / Lab..."
                                        value={groupMeta[group.id]?.department || ''}
                                        onChange={e => {
                                          const val = e.target.value;
                                          setGroupMeta(prev => ({
                                            ...prev,
                                            [group.id]: {
                                              ...prev[group.id],
                                              department: val
                                            }
                                          }));
                                        }}
                                      />
                                    )}
                                  </div>
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
              <div
                className="position-absolute top-0 start-0 end-0 d-flex align-items-center justify-content-between image-preview-floating-bar"
                onClick={e => e.stopPropagation()}
              >
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

      {/* Batch Multi-Folder Upload Modal - Mounted directly on document.body via React Portal */}
      {showBatchModal && createPortal(
        <>
          <div className="modal-backdrop fade show modern-backdrop" style={{ opacity: 0.75, zIndex: 10540 }} onClick={() => !batchUploading && setShowBatchModal(false)}></div>
          <div className="modal fade show d-block" tabIndex="-1" aria-hidden="true" style={{ zIndex: 10550 }} onClick={() => !batchUploading && setShowBatchModal(false)}>
            <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable" onClick={e => e.stopPropagation()}>
              <div className="modal-content overflow-hidden shadow-2xl border-0" style={{ background: 'var(--modal-bg, #0f172a)', border: '1px solid var(--border-color, rgba(255,255,255,0.12))', borderRadius: '24px' }}>
                <div className="modal-header border-0 p-4 pb-2 d-flex align-items-center justify-content-between flex-wrap gap-2">
                  <div className="d-flex align-items-center gap-3">
                    <div className="bg-primary bg-opacity-10 rounded-4 p-3 border border-primary border-opacity-15 text-primary d-flex align-items-center justify-content-center" style={{ width: '48px', height: '48px' }}>
                      <i className="bi bi-folder-symlink-fill fs-4"></i>
                    </div>
                    <div>
                      <h4 className="modal-title fw-bold text-heading mb-0">Multiple Folders Batch Import</h4>
                      <p className="text-secondary small mb-0 mt-0.5">
                        Detected <strong className="text-primary">{batchGroups.length} person folders</strong> containing {batchGroups.reduce((acc, g) => acc + g.files.length, 0)} total images.
                      </p>
                    </div>
                  </div>
                  <button type="button" className="btn-close text-dynamic" disabled={batchUploading} onClick={() => setShowBatchModal(false)}></button>
                </div>

                <div className="modal-body p-4 pt-3" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
                  {/* Step 1: Institutional Category & Course/Semester Assignment */}
                  <div className="p-3 mb-4 rounded-4" style={{ background: 'var(--bg-surface-solid, rgba(255,255,255,0.03))', border: '1px solid var(--border-color, rgba(255,255,255,0.08))' }}>
                    <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
                      <span className="small fw-bold text-uppercase text-secondary" style={{ fontSize: '0.72rem', letterSpacing: '0.5px' }}>
                        <i className="bi bi-tag-fill text-primary me-1"></i> Apply Classification To All Detected Folders:
                      </span>
                      <span className="badge rounded-pill bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25" style={{ fontSize: '0.74rem' }}>
                        {batchCategory === 'STUDENT' ? batchClass : (batchDept || 'No Department')}
                      </span>
                    </div>

                    {/* Category Selection Pills */}
                    <div className="d-flex flex-wrap gap-2 mb-3">
                      {CATEGORIES.filter(c => c.key !== 'ALL').map(cat => {
                        const isCatActive = batchCategory === cat.key;
                        return (
                          <button
                            key={cat.key}
                            type="button"
                            className={`btn btn-sm rounded-pill px-3 py-1 fw-bold transition-all d-flex align-items-center gap-1.5 ${
                              isCatActive
                                ? 'btn-primary shadow-sm'
                                : 'btn-outline-secondary border-secondary border-opacity-25 text-heading'
                            }`}
                            style={{ fontSize: '0.78rem' }}
                            onClick={() => setBatchCategory(cat.key)}
                          >
                            <i className={`bi ${cat.icon}`}></i>
                            <span>{cat.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Conditional: Course & Dynamic Semester Buttons for Students */}
                    {batchCategory === 'STUDENT' ? (
                      <div className="d-flex flex-column gap-2 pt-2 border-top border-white border-opacity-10">
                        {/* Course Row */}
                        <div className="d-flex flex-wrap gap-1.5 align-items-center">
                          <span className="small text-secondary fw-bold text-uppercase me-1" style={{ fontSize: '0.7rem' }}>Course:</span>
                          {Object.entries(COURSE_CONFIG).map(([cKey, cfg]) => (
                            <button
                              key={cKey}
                              type="button"
                              className={`btn btn-sm rounded-pill px-2.5 py-0.5 fw-bold transition-all ${
                                batchCourse === cKey
                                  ? 'btn-primary shadow-sm'
                                  : 'btn-outline-secondary text-heading border-secondary border-opacity-25'
                              }`}
                              style={{ fontSize: '0.74rem' }}
                              onClick={() => handleBatchCourseSelect(cKey)}
                            >
                              <i className={`bi ${cfg.icon} me-1`}></i>
                              {cKey}
                            </button>
                          ))}
                        </div>

                        {/* Semester Row */}
                        <div className="d-flex flex-wrap gap-1 align-items-center">
                          <span className="small text-secondary fw-bold text-uppercase me-1" style={{ fontSize: '0.7rem' }}>
                            {batchCourse} Sem ({COURSE_CONFIG[batchCourse]?.totalSem || 0} Sems):
                          </span>
                          {getCourseSemesters(batchCourse).map(sem => (
                            <button
                              key={sem}
                              type="button"
                              className={`btn btn-sm rounded-pill px-2 py-0.5 fw-bold transition-all ${
                                batchSem === sem
                                  ? 'btn-primary shadow-sm'
                                  : 'btn-outline-secondary text-heading border-secondary border-opacity-25'
                              }`}
                              style={{ fontSize: '0.72rem' }}
                              onClick={() => handleBatchSemSelect(sem)}
                            >
                              {sem}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="pt-2 border-top border-white border-opacity-10">
                        <input
                          type="text"
                          className="form-control form-control-sm rounded-pill px-3 py-1.5"
                          placeholder="Department / Lab name for all (e.g. Computer Science, Admin)..."
                          value={batchDept}
                          onChange={e => setBatchDept(e.target.value)}
                          style={{ maxWidth: '350px', fontSize: '0.8rem', background: 'var(--bg-input)', color: 'var(--text-heading)' }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Step 2: Detected People List */}
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <span className="small fw-bold text-uppercase text-secondary" style={{ fontSize: '0.72rem', letterSpacing: '0.5px' }}>
                      Detected Folders ({batchGroups.length}) — Review & Adjust Names:
                    </span>
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm rounded-pill px-2.5 py-0.5 border-0 text-secondary"
                      style={{ fontSize: '0.72rem' }}
                      onClick={() => setBatchGroups([])}
                    >
                      Clear All
                    </button>
                  </div>

                  {batchGroups.length > 0 ? (
                    <div className="row row-cols-1 row-cols-md-2 g-2 mb-3">
                      {batchGroups.map((group, idx) => (
                        <div className="col" key={idx}>
                          <div
                            className="p-2.5 rounded-3 d-flex align-items-center gap-3 border border-white border-opacity-10 transition-all"
                            style={{ background: 'var(--bg-surface-solid, rgba(255,255,255,0.03))' }}
                          >
                            <div className="position-relative rounded-2 overflow-hidden flex-shrink-0" style={{ width: '48px', height: '48px', background: '#0f172a' }}>
                              <img src={group.previewUrl} className="w-100 h-100 object-fit-cover" alt={group.name} />
                              <span className="badge position-absolute bottom-0 end-0 bg-dark bg-opacity-75 text-white" style={{ fontSize: '0.58rem', padding: '1px 3px' }}>
                                {group.files.length}
                              </span>
                            </div>
                            <div className="flex-grow-1 min-w-0">
                              <input
                                type="text"
                                className="form-control form-control-sm rounded-pill px-3 py-1 fw-bold text-capitalize"
                                value={group.name}
                                onChange={e => handleUpdateGroupName(idx, e.target.value)}
                                placeholder="Person Name"
                                style={{ fontSize: '0.82rem', background: 'var(--bg-input, #0f172a)', color: 'var(--text-heading, #fff)' }}
                              />
                              <span className="small text-secondary mt-1 d-block" style={{ fontSize: '0.7rem' }}>
                                {group.files.length} photos • {batchCategory === 'STUDENT' ? (group.class_name || batchClass) : (group.department || batchDept || 'Staff')}
                              </span>
                            </div>
                            <button
                              type="button"
                              className="btn btn-outline-danger btn-sm rounded-circle p-0 d-flex align-items-center justify-content-center flex-shrink-0"
                              style={{ width: '28px', height: '28px' }}
                              onClick={() => handleRemoveBatchGroup(idx)}
                              title="Remove folder"
                            >
                              <i className="bi bi-x fs-6"></i>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 opacity-50">
                      <p className="text-secondary small">All folders cleared.</p>
                    </div>
                  )}

                  {/* Upload Progress Display */}
                  {batchUploading && (
                    <div className="p-3 rounded-4 border border-primary border-opacity-25 my-2" style={{ background: 'rgba(13, 110, 253, 0.08)' }}>
                      <div className="d-flex justify-content-between align-items-center mb-1.5">
                        <span className="small fw-bold text-heading">
                          <span className="spinner-border spinner-border-sm text-primary me-2" role="status"></span>
                          Uploading {batchProgress.current} of {batchProgress.total}: <strong className="text-primary text-capitalize">{batchProgress.currentName}</strong>
                        </span>
                        <span className="small font-mono fw-bold text-primary">
                          {Math.round((batchProgress.current / batchProgress.total) * 100)}%
                        </span>
                      </div>
                      <div className="progress" style={{ height: '8px', background: 'rgba(255,255,255,0.1)' }}>
                        <div
                          className="progress-bar progress-bar-striped progress-bar-animated bg-primary"
                          style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                        ></div>
                      </div>
                      <span className="small text-secondary d-block mt-2" style={{ fontSize: '0.72rem' }}>
                        Computing ArcFace facial embeddings automatically in background...
                      </span>
                    </div>
                  )}
                </div>

                <div className="modal-footer border-0 p-4 pt-2 d-flex gap-2">
                  <button
                    type="button"
                    className="btn btn-cancel-red rounded-pill px-4 flex-grow-1"
                    disabled={batchUploading}
                    onClick={() => setShowBatchModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary px-5 rounded-pill fw-bold flex-grow-1 d-flex align-items-center justify-content-center gap-2"
                    disabled={batchUploading || batchGroups.length === 0}
                    onClick={handleBatchUploadSubmit}
                  >
                    {batchUploading ? (
                      <>
                        <span className="spinner-border spinner-border-sm" role="status"></span>
                        <span>Uploading ({batchProgress.current}/{batchProgress.total})...</span>
                      </>
                    ) : (
                      <>
                        <i className="bi bi-cloud-arrow-up-fill"></i>
                        <span>Upload All {batchGroups.length} Folders</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}

      {/* Toast Notification System */}
      {toasts.length > 0 && createPortal(
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column-reverse',
          gap: '10px',
          maxWidth: '440px',
          width: '100%',
          pointerEvents: 'none',
        }}>
          {toasts.map(toast => {
            const isSuccess = toast.type === 'success';
            const isDeleted = toast.type === 'deleted';
            const isError = toast.type === 'error';
            const isWarning = toast.type === 'warning';

            const bgColor = isSuccess ? '#065f46' :
                            isDeleted ? '#7f1d1d' :
                            isError ? '#991b1b' :
                            isWarning ? '#78350f' : '#065f46';
            const borderColor = isSuccess ? '#10b981' :
                                isDeleted ? '#ef4444' :
                                isError ? '#ef4444' :
                                isWarning ? '#f59e0b' : '#10b981';
            const iconColor = isSuccess ? '#34d399' :
                              isDeleted ? '#fca5a5' :
                              isError ? '#fca5a5' :
                              isWarning ? '#fcd34d' : '#34d399';
            const icon = isSuccess ? 'bi-check-circle-fill' :
                         isDeleted ? 'bi-trash3-fill' :
                         isError ? 'bi-exclamation-triangle-fill' :
                         isWarning ? 'bi-exclamation-circle-fill' : 'bi-check-circle-fill';

            return (
              <div
                key={toast.id}
                className="ds-toast-notification"
                style={{
                  pointerEvents: 'auto',
                  background: bgColor,
                  border: `1px solid ${borderColor}`,
                  borderRadius: '12px',
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                  animation: 'dsToastSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                }}
              >
                <i className={`bi ${icon} flex-shrink-0`} style={{ color: iconColor, fontSize: '1.05rem' }}></i>
                <span style={{ color: '#fff', fontSize: '0.84rem', fontWeight: 600, lineHeight: 1.4 }}>{toast.message}</span>
                <button
                  type="button"
                  onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'rgba(255,255,255,0.5)',
                    cursor: 'pointer',
                    padding: '0',
                    marginLeft: 'auto',
                    flexShrink: 0,
                    fontSize: '0.9rem',
                    lineHeight: 1,
                  }}
                  title="Dismiss"
                >
                  <i className="bi bi-x-lg"></i>
                </button>
              </div>
            );
          })}
        </div>,
        document.body
      )}


      {/* Toast + Progress Animation Styles */}
      <style>{`
        @keyframes dsToastSlideIn {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes dsProgressPulse {
          0% { opacity: 0.7; }
          50% { opacity: 1; }
          100% { opacity: 0.7; }
        }
      `}</style>
    </>
  );
}
