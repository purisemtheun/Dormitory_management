// frontend/src/api/reports.api.js
import http from "../services/http";

const GET  = (url, params) => http.get(url, { params });
const POST = (url, data)   => http.post(url, data);

/**
 * Frontend API wrapper ที่ “เข้ากันได้ย้อนหลัง”
 * - มีเมธอดแบบ flat ที่ ReportsPage และ components เรียกอยู่
 * - มี alias แบบ object (revenue.daily / revenue.monthly) เผื่อโค้ดเก่า
 */
const reportApi = {
  /* ---------- Rooms ---------- */
  roomsStatus: () => GET("/reports/rooms-status"),

  /* ---------- Revenue ---------- */
  // ใช้สรุปรายเดือน (รวมทั้งหอ) จาก backend /monthly-summary
  revenueMonthly: (months = 6) => GET("/reports/monthly-summary", { months }),
  // รายวัน สำหรับช่วงวันที่ที่เลือก
  revenueDaily: (from, to) => GET("/reports/revenue-daily", { from, to }),

  // alias รูปแบบเดิม
  revenue: {
    monthly: (params) =>
      GET("/reports/monthly-summary", { months: params?.months ?? params ?? 6 }),
    daily: (params) => GET("/reports/revenue-daily", params),
  },

  /* ---------- Payments / Debts ---------- */
  payments: (from, to) => GET("/reports/payments", { from, to }),
  debts: (asOf) => GET("/reports/debts", asOf ? { asOf } : {}),

  /* ---------- Utilities (น้ำ/ไฟ) ---------- */
  meterMonthly: (ym) => GET("/reports/meter-monthly", { ym }),
  meterMonthlySimple: (ym) => GET("/reports/meter-monthly", { ym }),
  getMeterMonthly: (ym) => GET("/reports/meter-monthly", { ym }),
  getMeterMonthlySimple: (args) =>
    GET("/reports/meter-monthly", { ym: args?.ym ?? args }),

  meterSaveSimple: (payload) => POST("/reports/meter/save-simple", payload),
  saveMeterSimple: (payload) => POST("/reports/meter/save-simple", payload),
  meterSaveReading: (payload) => POST("/reports/meter/save-simple", payload),

  toggleMeterLock: (payload) => POST("/reports/meter/toggle-lock", payload),

  /* ---------- generic ---------- */
  get: (path, params) => GET(path, params),
};

export { reportApi };
export default reportApi;
