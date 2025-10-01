// (ทางเลือก) ใช้ fetch แต่ต้องใส่ token เอง
import { getToken } from "../utils/auth";

const API = process.env.REACT_APP_API_URL || "";
const base = `${API}/api/admin/tenants`;

async function j(req) {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(req.headers || {}),
  };
  const res = await fetch(req.url, { ...req, headers, credentials: "include" });
  const text = await res.text();
  let data; try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok) {
    const err = new Error(data.error || data.message || `HTTP ${res.status}`);
    err.status = res.status; err.code = data.code; err.payload = data;
    throw err;
  }
  return data;
}

export const tenantApi = {
  list:   (q)    => j({ url: q ? `${base}?q=${encodeURIComponent(q)}` : base, method: "GET" }),
  create: (body) => j({ url: base, method: "POST", body: JSON.stringify(body) }),
  update: (id,b) => j({ url: `${base}/${encodeURIComponent(id)}`, method: "PATCH", body: JSON.stringify(b) }),
  remove: (id)   => j({ url: `${base}/${encodeURIComponent(id)}`, method: "DELETE" }),
};
