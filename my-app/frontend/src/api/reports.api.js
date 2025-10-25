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
  if (!r.ok) {
    // ✅ อย่าให้หน้าแตก: ถ้า 404 ให้คืนอาร์เรย์ว่าง
    if (r.status === 404) return [];
    const text = await r.text().catch(() => "");
    throw new Error(`${r.status} ${r.statusText} :: ${text}`);
  }
  const data = await r.json().catch(() => null);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.summary)) return data.summary;
  return [];
}

export const reportApi = {
  roomsStatus: () => j(`${BASE}/reports/rooms-status`),
  revenueMonthly: (months = 6) =>
    j(`${BASE}/reports/revenue?granularity=monthly&months=${months}`),
  revenueDaily: (from, to) =>
    j(`${BASE}/reports/revenue?granularity=daily&from=${from}&to=${to}`),
  debts: (asOf) => j(`${BASE}/reports/debts${asOf ? `?asOf=${asOf}` : ""}`),
  payments: (from, to) => j(`${BASE}/reports/payments?from=${from}&to=${to}`),

  // ✅ ใหม่: ดึงค่าน้ำ/ค่าไฟรายเดือนต่อห้อง (อิง meter_readings)
  meterMonthly: (ym) => j(`${BASE}/reports/meter-monthly?ym=${ym}`),
};
