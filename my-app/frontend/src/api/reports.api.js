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
  /* ===== รายงานเดิม ===== */
  roomsStatus    : () => j(`${BASE}/reports/rooms-status`),
  revenueMonthly : (months = 6) => j(`${BASE}/reports/monthly-summary?months=${months}`),
  revenueDaily   : (from, to) => j(`${BASE}/reports/revenue?granularity=daily&from=${from}&to=${to}`),

  /* ✅ ใช้ endpoint ใหม่สำหรับแท็บ Debts (แยกหมวดรายใบแจ้งหนี้) */
  debts          : (asOf) => j(`${BASE}/admin/debts/by-invoice${asOf ? `?asOf=${asOf}` : ""}`),

  payments       : (from, to) => j(`${BASE}/reports/payments?from=${from}&to=${to}`),

  /* ===== Utilities ===== */
  meterMonthly    : (ym) => j(`${BASE}/reports/meter-monthly?ym=${ym}`),
  meterSaveSimple : (payload) => j(`${BASE}/reports/meter/save-simple`, { method: "POST", body: JSON.stringify(payload) }),
  meterToggleLock : (payload) => j(`${BASE}/reports/meter/toggle-lock`, { method: "POST", body: JSON.stringify(payload) }),
  revenueMonthlyBreakdown: (period_ym) => j(`${BASE}/reports/monthly-breakdown/${period_ym}`),

  /* ===== ใหม่: หัวการ์ด/ค้นหาแบบต่อผู้เช่า (ถ้าคุณใช้หน้า “ค้นหาหนี้ผู้เช่า”) ===== */
  debtsSummary: () => j(`${BASE}/admin/debts/summary`),           // เดิมชี้ /debts → แก้เป็น /admin/debts
  debtsSearch : (qsObj = {}) => {
    const qs = new URLSearchParams(qsObj).toString();
    return j(`${BASE}/admin/debts/search${qs ? `?${qs}` : ""}`);  // เดิมชี้ /debts → แก้เป็น /admin/debts
  },
};
