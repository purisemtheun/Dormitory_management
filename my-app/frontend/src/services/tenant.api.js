// src/services/tenant.api.js
const base = "/api/admin/tenants";

// helper เรียก fetch + จัดการ error ให้มี message/status/code
async function j(req) {
  const headers = { "Content-Type": "application/json", ...(req.headers || {}) };
  const res = await fetch(req.url, { ...req, headers });

  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }

  if (!res.ok) {
    const err = new Error(data.error || data.message || `HTTP ${res.status}`);
    err.status = res.status;
    err.code = data.code;
    err.payload = data;
    throw err;
  }
  return data;
}

// ✅ export ชื่อ tenantApi และมีเมธอด create ที่หายไป
export const tenantApi = {
  list:   (q)   => j({ url: q ? `${base}?q=${encodeURIComponent(q)}` : base, method: "GET" }),
  create: (body)=> j({ url: base, method: "POST", body: JSON.stringify(body) }),
  update: (id, body) =>
          j({ url: `${base}/${encodeURIComponent(id)}`, method: "PATCH", body: JSON.stringify(body) }),
  remove: (id)  => j({ url: `${base}/${encodeURIComponent(id)}`, method: "DELETE" }),
};


