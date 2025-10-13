// frontend/src/services/api.js
import axios from 'axios';

// ✅ รองรับทั้ง CRA (process.env.REACT_APP_*) และ Vite (import.meta.env.*)
//   - CRA: ใช้ REACT_APP_API_BASE_URL
//   - Vite: ใช้ VITE_API_BASE_URL (ประเมินผ่าน new Function เลี่ยง Babel parse error)
let viteBaseURL;
try {
  // eslint-disable-next-line no-new-func
  viteBaseURL = new Function(
    'try { return (import.meta && import.meta.env && import.meta.env.VITE_API_BASE_URL) || undefined } catch (e) { return undefined }'
  )();
} catch (_) {
  viteBaseURL = undefined;
}

const baseURL =
  viteBaseURL ||
  process.env.REACT_APP_API_BASE_URL ||
  'http://localhost:3000/api';

const api = axios.create({
  baseURL,
  withCredentials: true, // ส่ง cookie ถ้า backend ใช้ JWT cookie
});

// แนบ Bearer token ถ้ามีเก็บไว้ใน localStorage
api.interceptors.request.use((config) => {
  try {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  } catch (_) {}
  return config;
});

export default api;
