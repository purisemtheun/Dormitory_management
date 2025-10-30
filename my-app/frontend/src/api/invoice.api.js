// src/api/invoice.api.js
import { getToken } from "../utils/auth";

// ดึงรายการล่าสุด (พยายามทั้ง 2 endpoint; ถ้าไม่พบ คืน [])
export async function listRecentInvoices(limit = 10) {
  const headers = { Authorization: `Bearer ${getToken()}` };

  async function tryOnce(url) {
    const r = await fetch(url, { headers });
    const text = await r.text();
    let d = {};
    try { d = JSON.parse(text); } catch {}
    if (!r.ok) {
      if (r.status === 404 || /not\s*found/i.test(text)) return []; // ไม่มีข้อมูล
      throw new Error(d?.error || d?.message || `GET ${url} failed`);
    }
    return Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : []);
  }

  // ปรับ URL ให้ตรงกับ backend ของคุณ ถ้าคุณมี path ที่แน่นอน
  let rows = await tryOnce(`/api/admin/invoices?order=desc&limit=${limit}`);
  if (rows.length === 0) {
    rows = await tryOnce(`/api/invoices?order=desc&limit=${limit}`);
  }
  return rows;
}

export async function createInvoice(payload) {
  const r = await fetch("/api/admin/invoices", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(payload),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error || d?.message || "ออกใบแจ้งหนี้ไม่สำเร็จ");
  return d;
}
