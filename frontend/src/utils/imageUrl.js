import API from '../api/axios';

/**
 * Robustly constructs an absolute URL for image paths,
 * ensuring compatibility across browser and Android WebView contexts.
 */
export const getImageUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path;
  }

  // 1. Check custom saved server IP (Mobile App setting)
  const savedIp = localStorage.getItem('server_ip');
  let rawBase = '';
  if (savedIp) {
    const cleanIp = savedIp.trim().replace(/\/+$/, '');
    rawBase = cleanIp.startsWith('http') ? cleanIp : `http://${cleanIp}`;
  } else if (API.defaults.baseURL) {
    rawBase = API.defaults.baseURL;
  } else {
    rawBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
  }

  // Strip trailing /api or /api/
  const backendBase = rawBase.replace(/\/api\/?$/, '').replace(/\/+$/, '');

  let cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (!cleanPath.startsWith('/media/')) {
    cleanPath = `/media${cleanPath}`;
  }

  return `${backendBase}${cleanPath}`;
};

export default getImageUrl;
