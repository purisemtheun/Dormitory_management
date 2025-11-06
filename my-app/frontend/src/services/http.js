// frontend/src/services/http.js
import axios from "axios";
import { getToken, clearToken } from "../utils/auth";

/**
 * BASE URL RULES
 * - DEV (CRA proxy): ปล่อยค่าว่าง => เรียก relative path เช่น /api/... แล้วให้ proxy ใน package.json ทำงาน
 *   - package.json ต้องมี "proxy": "http://localhost:3000" (หรือพอร์ต backend ของคุณ)
 * - PROD: ตั้ง REACT_APP_API_URL เป็น URL เต็มที่ลงท้ายด้วย /api  เช่น https://your-backend.onrender.com/api
 */
const BASE =
  process.env.REACT_APP_API_URL ??
  process.env.REACT_APP_API_BASE ??
  ""; // ว่าง = same-origin (ใช้ proxy ตอน dev)

const http = axios.create({
  baseURL: BASE,          // ตัว services ควรเรียกเป็น path ที่ "ไม่" ใส่ /api ซ้ำ ถ้า BASE ลงท้ายด้วย /api แล้ว
  timeout: 20000,
  // ถ้าใช้คุ้กกี้ session ให้เปิดบรรทัดนี้
  // withCredentials: true,
});

// ===== Request: แนบ Bearer token ถ้ามี =====
http.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers = { ...(config.headers || {}), Authorization: `Bearer ${token}` };
  }
  // กันเคสเขียน path เริ่มด้วย //api (เผลอพิมพ์ /api ซ้ำ)
  if (typeof config.url === "string") {
    config.url = config.url.replace(/\/\/+/g, "/");
  }
  return config;
});

// ===== Response: รวมข้อความ error + handle 401 =====
http.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    const msg =
      err?.response?.data?.message ||
      err?.response?.data?.error ||
      err?.message ||
      `Request failed${status ? ` (${status})` : ""}`;

    if (status === 401) {
      clearToken();
      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        window.location.replace("/login");
      }
    }

    // โยนเป็น Error ปกติให้หน้าจอแสดงได้
    return Promise.reject(new Error(msg));
  }
);

export default http;
