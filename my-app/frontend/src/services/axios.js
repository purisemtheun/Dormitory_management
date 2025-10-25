// src/services/axios.js
import axios from "axios";

/** เลือก BASE URL อัตโนมัติ
 * - Vite:   import.meta.env.VITE_API_BASE       (เช่น http://localhost:3000/api)
 * - CRA:    process.env.REACT_APP_API_BASE หรือ REACT_APP_API
 * - ค่าเริ่ม: '/api' (แนะนำเมื่อทำ reverse-proxy ที่ dev/prod)
 */
function computeApiBase() {
  // Vite
  // eslint-disable-next-line no-undef
  const vite = typeof import !== "undefined"
    && typeof import.meta !== "undefined"
    && import.meta.env
    && import.meta.env.VITE_API_BASE;
  if (vite) return vite;

  // CRA
  const cra = process.env.REACT_APP_API_BASE || process.env.REACT_APP_API;
  if (cra) return cra;

  // Fallback (ใช้ relative path)
  return "/api";
}

/** อ่าน token จากหลายที่ เพื่อให้เข้ากันได้กับโค้ดเดิม */
export function pickToken() {
  const t1 = localStorage.getItem("token");
  const t2 = sessionStorage.getItem("token");

  let t3 = null;
  const raw = localStorage.getItem("auth") || sessionStorage.getItem("auth");
  if (raw) {
    try {
      const obj = JSON.parse(raw);
      t3 = obj?.token || obj?.accessToken || null;
    } catch {
      // ignore
    }
  }
  return t1 || t2 || t3 || null;
}

/** ตั้ง/ล้าง token แบบ manual ได้ */
export function setAuthToken(token) {
  if (token) localStorage.setItem("token", token);
  else localStorage.removeItem("token");
}
export function clearAuth() {
  localStorage.removeItem("token");
  localStorage.removeItem("auth");
  sessionStorage.removeItem("token");
  sessionStorage.removeItem("auth");
}

/** สร้าง instance หลัก */
const api = axios.create({
  baseURL: computeApiBase(),
  withCredentials: false,        // ใช้ cookie-session ค่อยเปลี่ยนเป็น true
  timeout: 20000,                // 20s
  headers: { Accept: "application/json" },
});

/** Request interceptor: แปะ Bearer token + กัน cache สำหรับ GET */
api.interceptors.request.use(
  (config) => {
    const token = pickToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      config.headers["x-access-token"] = token; // เผื่อโค้ดฝั่ง server รับหัวนี้
    }
    if ((config.method || "").toLowerCase() === "get") {
      config.headers["Cache-Control"] = "no-cache";
      config.headers.Pragma = "no-cache";
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/** Response interceptor: โยน error ให้อ่านง่ายขึ้น + hook 401 */
api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error?.response?.status;
    const data = error?.response?.data;
    const message =
      (data && (data.error || data.message)) ||
      error?.message ||
      "Request failed";

    // ถ้าต้องการ redirect ไป /login เมื่อ 401 ให้เปิดบรรทัดล่าง
    // if (status === 401) {
    //   clearAuth();
    //   window.location.assign("/login");
    // }

    return Promise.reject(new Error(message));
  }
);

export default api;

/** helper: เรียกใช้งานแบบสั้น ๆ
 *  ตัวอย่าง:  apiGet('/reports/rooms-status')
 */
export async function apiGet(url, params) {
  const res = await api.get(url, { params });
  return res.data;
}
export async function apiPost(url, body, config) {
  const res = await api.post(url, body, config);
  return res.data;
}
export async function apiPut(url, body, config) {
  const res = await api.put(url, body, config);
  return res.data;
}
export async function apiDel(url, config) {
  const res = await api.delete(url, config);
  return res.data;
}

/** debug export */
export const API_BASE = api.defaults.baseURL;
