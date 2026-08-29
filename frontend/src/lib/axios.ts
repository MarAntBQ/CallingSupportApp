import axios from 'axios';
import { clearSession, getToken } from './auth';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3020';

const api = axios.create({
  baseURL: API_BASE,
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !window.location.pathname.startsWith('/login')) {
      clearSession();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

export default api;
