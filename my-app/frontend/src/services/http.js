// src/services/http.js
import axios from "axios";
import { getToken, clearToken } from "../utils/auth";

const http = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "http://localhost:3000",
  timeout: 15000,
});

http.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

http.interceptors.response.use(
  (res) => res,
  (err) => {
    // Network/CORS/timeout ไม่มี response เลย
    if (!err.response) {
      if (process.env.NODE_ENV === "development") {
        // eslint-disable-next-line no-console
        console.warn("[HTTP] Network error:", err?.message, err?.code);
      }
      return Promise.reject(err);
    }

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

export default http;
