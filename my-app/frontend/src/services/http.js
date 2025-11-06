// frontend/src/services/http.js
import axios from "axios";

/**
 * การตั้งค่า baseURL:
 * - ถ้าเซ็ต REACT_APP_API_URL -> ใช้ค่านั้น เช่น https://api.example.com
 * - ถ้าไม่ได้เซ็ต -> ใช้ same-origin แล้วพาธขึ้นต้นด้วย /api/* (เหมาะกับ Nginx proxy)
 */
const API_BASE =
  (typeof process !== "undefined" && process.env && process.env.REACT_APP_API_URL) || "";

/**
 * ฟังก์ชันอ่าน/ลบโทเค็น:
 * - เก็บ/อ่านจาก localStorage คีย์เดียว: dm_token
 * - ถ้าโปรเจ็กต์เดิมใช้คีย์อื่น ให้ย้าย/แมปที่นี่ บรรทัด getLegacyToken()
 */
function getLegacyToken() {
  // รองรับคีย์เก่า ๆ ที่อาจใช้มาแล้วในโปรเจ็กต์
  const legacyKeys = ["token", "access_token", "auth_token"];
  for (const k of legacyKeys) {
    const v = window.localStorage.getItem(k);
    if (v) return v;
  }
  return null;
}
export function getToken() {
  return window.localStorage.getItem("dm_token") || getLegacyToken() || null;
}
export function setToken(token) {
  if (token) window.localStorage.setItem("dm_token", token);
}
export function clearToken() {
  try {
    window.localStorage.removeItem("dm_token");
    // เคลียร์คีย์เก่าด้วยกันพลาด
    ["token", "access_token", "auth_token"].forEach((k) =>
      window.localStorage.removeItem(k)
    );
  } catch {}
}

const instance = axios.create({
  baseURL: API_BASE, // ว่าง = same-origin
  timeout: 20000,
});

// ใส่ Authorization header ทุกครั้งถ้ามีโทเค็น
instance.interceptors.request.use((config) => {
  const t = getToken();
  if (t) {
    config.headers = {
      ...(config.headers || {}),
      Authorization: `Bearer ${t}`,
    };
  }
  // ปลอดภัยไว้ก่อน
  if (!config.headers || !config.headers["Content-Type"]) {
    config.headers = { ...(config.headers || {}), "Content-Type": "application/json" };
  }
  return config;
});

// ดัก 401 -> ลบโทเค็น + เด้งไป /login
instance.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    if (status === 401) {
      clearToken();
      // กันลูปบนหน้า /login เอง
      if (typeof window !== "undefined") {
        const here = window.location?.pathname || "/";
        if (here !== "/login") window.location.assign("/login");
      }
    }
    return Promise.reject(err);
  }
);

export default instance;
