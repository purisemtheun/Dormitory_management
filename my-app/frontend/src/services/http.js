// frontend/src/services/http.js
import axios from "axios";
import { getToken, clearToken } from "../utils/auth";

// ถ้าใช้ CRA proxy ให้ตั้ง REACT_APP_API_URL = "" หรือไม่ตั้งเลย
// ถ้าไม่ใช้ proxy ให้ตั้ง REACT_APP_API_URL=http://localhost:3001 ใน .env
const baseURL = process.env.REACT_APP_API_URL ?? ""; // empty means same origin (use CRA proxy)

const instance = axios.create({
  baseURL,
  timeout: 15000,
});

instance.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers = { ...(config.headers || {}), Authorization: `Bearer ${token}` };
  return config;
});

// Response interceptor: ถ้า 401 ให้เคลียร์ token แล้ว redirect (optional)
instance.interceptors.response.use(
  (res) => res,
  (err) => {
    if (!err.response) return Promise.reject(err); // network / CORS / timeout
    if (err.response.status === 401) {
      clearToken();
      if (typeof window !== "undefined" && window.location && window.location.pathname !== "/login") {
        window.location.replace("/login");
      }
    }
    return Promise.reject(err);
  }
);

export default instance;
