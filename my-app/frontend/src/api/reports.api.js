// frontend/src/api/reports.api.js
const BASE = process.env.REACT_APP_API_BASE || process.env.REACT_APP_API || "http://localhost:3000/api";
const TOKEN_KEY = process.env.REACT_APP_TOKEN_KEY || "dm_token";

function authHeaders() {
  try {
    const t = localStorage.getItem(TOKEN_KEY);
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch {
    return {};
  }
}

async function j(url, opts = {}) {
  const r = await fetch(url, {
    method: "GET",
    ...opts,
    headers: { "Content-Type": "application/json", ...authHeaders(), ...(opts.headers || {}) },
    credentials: "include",
  });
  if (!r.ok) {
    // ตัดข้อความแบบอ่านง่าย (เช่น 502)
    const msg = `${r.status} ${r.statusText}`;
    throw new Error(msg);
  }
  const data = await r.json().catch(() => null);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  return data || {};
}

export const reportApi = {
  // Rooms
  roomsStatus      : () => j(`${BASE}/reports/rooms-status`),

  // Revenue
  revenueMonthly   : (months = 6) => j(`${BASE}/reports/monthly-summary?months=${months}`),
  revenueDaily     : (from, to)   => j(`${BASE}/reports/revenue?granularity=daily&from=${from}&to=${to}`),

  // Debts (ตามใบแจ้งหนี้)
  debts            : (asOf) => j(`${BASE}/admin/debts/by-invoice${asOf ? `?asOf=${asOf}` : ""}`),

  // Payments
  payments         : (from, to) => j(`${BASE}/reports/payments?from=${from}&to=${to}`),

  // Utilities (meters)
  meterMonthly     : (ym) => j(`${BASE}/reports/meter-monthly?ym=${ym}`),
  meterSaveSimple  : (payload) => j(`${BASE}/reports/meter/save-simple`, { method: "POST", body: JSON.stringify(payload) }),
};
