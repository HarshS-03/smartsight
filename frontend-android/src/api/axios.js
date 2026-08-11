import axios from 'axios';

// Detect if running inside Capacitor (Mobile App) vs Browser
const isCapacitor = () => {
  return window.Capacitor !== undefined || window.location.protocol === 'capacitor:';
};

// Dynamically resolve API Base URL (Useful for Mobile App)
const getApiBaseUrl = () => {
  // 1. Check if user configured a custom IP in the mobile app (e.g. 192.168.1.10:8000)
  const savedIp = localStorage.getItem('server_ip');
  if (savedIp) {
    // Ensure it has http:// or https:// and trim spaces
    const cleanIp = savedIp.trim().replace(/\/+$/, '');
    return cleanIp.startsWith('http') ? `${cleanIp}/api` : `http://${cleanIp}/api`;
  }
  // 2. Default to environment variable or localhost
  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
};

const API = axios.create({
  baseURL: getApiBaseUrl(),
  // withCredentials must be false on mobile (Capacitor) to avoid CORS preflight failures.
  // JWT Bearer tokens are used for auth, so cookies/credentials are not needed.
  withCredentials: !isCapacitor(),
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Allow updating the base URL dynamically when settings change
API.updateBaseUrl = () => {
  API.defaults.baseURL = getApiBaseUrl();
  // Also update withCredentials in case platform changed (shouldn't, but safe)
  API.defaults.withCredentials = !isCapacitor();
};

// Helper function to extract CSRF token from document cookies for Django session auth
function getCsrfToken() {
  const name = 'csrftoken=';
  const decodedCookie = decodeURIComponent(document.cookie);
  const ca = decodedCookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i].trim();
    if (c.indexOf(name) === 0) {
      return c.substring(name.length, c.length);
    }
  }
  return null;
}

// Request Interceptor: Attach CSRF Token and Bearer Auth Token if present
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Only attach CSRF token in browser context (not mobile)
  if (!isCapacitor()) {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      config.headers['X-CSRFToken'] = csrfToken;
    }
  }

  return config;
});

// Response Interceptor: Global Error & Unauthenticated handling
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.warn('[API Auth] Unauthorized access - token may be expired');
    }
    return Promise.reject(error);
  }
);

export default API;
