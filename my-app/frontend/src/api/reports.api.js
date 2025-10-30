// src/api/reports.api.js
const BASE = process.env.REACT_APP_API_BASE || "http://localhost:3000/api";
const TOKEN_KEY = process.env.REACT_APP_TOKEN_KEY || "dm_token";

function authHeaders() {
  const t = localStorage.getItem(TOKEN_KEY);
  return t ? { Authorization: `Bearer ${t}` } : {};
}
async function j(url, opts = {}) {
  const r = await fetch(url, {
    method: "GET",
    ...opts,
    headers: { "Content-Type": "application/json", ...authHeaders(), ...(opts.headers || {}) },
  });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  const data = await r.json().catch(() => null);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  return data || {};
}

export const reportApi = {
  /* ===== รายงาน ===== */
  roomsStatus    : () => j(`${BASE}/reports/rooms-status`),

  // รายเดือนรวมทั้งหอ (เชื่อม rooms.price + meter_readings ตามโค้ด backend ที่คุณมี)
  revenueMonthly : (months = 6) => j(`${BASE}/reports/monthly-summary?months=${months}`),

  // รายวัน (ยังใช้ของเดิม)
  revenueDaily   : (from, to) => j(`${BASE}/reports/revenue?granularity=daily&from=${from}&to=${to}`),

  // ของเดิม ยังอยู่เพื่อความเข้ากันได้
  debts          : (asOf) => j(`${BASE}/reports/debts${asOf ? `?asOf=${asOf}` : ""}`),
  payments       : (from, to) => j(`${BASE}/reports/payments?from=${from}&to=${to}`),

  /* ===== Utilities: ค่าน้ำ/ไฟ ===== */
  meterMonthly    : (ym) => j(`${BASE}/reports/meter-monthly?ym=${ym}`),
  meterSaveSimple : (payload) => j(`${BASE}/reports/meter/save-simple`, { method: "POST", body: JSON.stringify(payload) }),
  meterToggleLock : (payload) => j(`${BASE}/reports/meter/toggle-lock`, { method: "POST", body: JSON.stringify(payload) }),

  // เจาะเดือนตามห้อง
  revenueMonthlyBreakdown: (period_ym) => j(`${BASE}/reports/monthly-breakdown/${period_ym}`),

  /* ===== ใหม่: หนี้ ===== */
  debtsSummary: () => j(`${BASE}/debts/summary`),                // ตัวเลขการ์ด (0 ถ้าไม่มี)
  debtsSearch : (qsObj = {}) => {
    const qs = new URLSearchParams(qsObj).toString();
    return j(`${BASE}/debts/search${qs ? `?${qs}` : ""}`);
  },
};
