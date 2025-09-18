// src/services/http.js
import axios from "axios";
import { getToken, clearToken } from "../utils/auth";

// ใช้ชื่อตัวแปรเดียว ห้ามประกาศซ้ำ
const instance = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "http://localhost:3000",
  timeout: 15000,
});

instance.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

instance.interceptors.response.use(
  (res) => res,
  (err) => {
    // Network/CORS/timeout
    if (!err.response) return Promise.reject(err);

    if (err.response.status === 401) {
      clearToken();
      if (typeof window !== "undefined" &&
          window.location &&
          window.location.pathname !== "/login") {
        window.location.replace("/login");
      }
    }
    return Promise.reject(err);
  }
);

// export เป็น default เดียว
export default instance;
