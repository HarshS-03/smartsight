import axios from 'axios';

// Dynamically resolve API Base URL (Supports custom IP or default localhost)
const getApiBaseUrl = () => {
  const savedIp = localStorage.getItem('server_ip');
  if (savedIp) {
    const cleanIp = savedIp.trim().replace(/\/+$/, '');
    return cleanIp.startsWith('http') ? `${cleanIp}/api` : `http://${cleanIp}/api`;
  }
  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
};

const API = axios.create({
  baseURL: getApiBaseUrl(),
  // withCredentials is false to prevent CORS credential restrictions.
  // JWT Bearer tokens are used for all authentication.
  withCredentials: false,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Allow updating the base URL dynamically when settings change
API.updateBaseUrl = () => {
  API.defaults.baseURL = getApiBaseUrl();
  API.defaults.withCredentials = false;
};

// Request Interceptor: Attach Bearer Auth Token if present
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
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

