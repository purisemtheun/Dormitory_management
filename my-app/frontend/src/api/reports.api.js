// ✅ แก้: ใส่ /api นำหน้าให้ทุก endpoint
import http from "../services/http";

const GET  = (url, params) => http.get(url, { params });
const POST = (url, data)   => http.post(url, data);

/**
 * Frontend API wrapper
 */
const reportApi = {
  /* ---------- Rooms ---------- */
  roomsStatus: () => GET("/api/reports/rooms-status"),

  /* ---------- Revenue ---------- */
  revenueMonthly: (months = 6) => GET("/api/reports/monthly-summary", { months }),
  revenueDaily: (from, to) => GET("/api/reports/revenue-daily", { from, to }),

  // alias รูปแบบเดิม
  revenue: {
    monthly: (params) =>
      GET("/api/reports/monthly-summary", { months: params?.months ?? params ?? 6 }),
    daily: (params) => GET("/api/reports/revenue-daily", params),
  },

  /* ---------- Payments / Debts ---------- */
  payments: (from, to) => GET("/api/reports/payments", { from, to }),
  debts: (asOf) => GET("/api/reports/debts", asOf ? { asOf } : {}),

  /* ---------- Utilities (น้ำ/ไฟ) ---------- */
  meterMonthly: (ym) => GET("/api/reports/meter-monthly", { ym }),
  meterMonthlySimple: (ym) => GET("/api/reports/meter-monthly", { ym }),
  getMeterMonthly: (ym) => GET("/api/reports/meter-monthly", { ym }),
  getMeterMonthlySimple: (args) =>
    GET("/api/reports/meter-monthly", { ym: args?.ym ?? args }),

  meterSaveSimple: (payload) => POST("/api/reports/meter/save-simple", payload),
  saveMeterSimple: (payload) => POST("/api/reports/meter/save-simple", payload),
  meterSaveReading: (payload) => POST("/api/reports/meter/save-simple", payload),

  toggleMeterLock: (payload) => POST("/api/reports/meter/toggle-lock", payload),

  /* ---------- generic ---------- */
  get: (path, params) => GET(path.startsWith("/api") ? path : `/api${path}`, params),
};

export { reportApi };
export default reportApi;
