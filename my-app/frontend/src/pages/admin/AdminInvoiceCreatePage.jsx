// frontend/src/pages/admin/AdminPaymentsPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { getToken } from "../../utils/auth";

/* ======= helper: safe fetch + parse ======= */
async function parseResponseSafe(res) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    // ถ้าไม่ใช่ JSON คืน raw text
    return text;
  }
}
async function safeFetch(url, opts) {
  const res = await fetch(url, opts);
  const data = await parseResponseSafe(res);
  if (!res.ok) {
    const msg = (data && (data.error || data.message)) || res.statusText || "Request failed";
    const err = new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
    err.status = res.status;
    err.payload = data;
    throw err;
  }
  return data;
}

/* ===================== API helpers ===================== */
const api = {
  getPending: async () => {
    return await safeFetch("/api/admin/invoices/pending", {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
  },
  decide: async (id, action) => {
    return await safeFetch(`/api/admin/invoices/${id}/decision`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ action }),
    });
  },
  // สำหรับ dropdown: โหลด tenants / สร้าง invoice / สร้างเดือน
  getTenants: async () => {
    return await safeFetch("/api/admin/tenants", {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
  },
  createInvoice: async (payload) => {
    return await safeFetch("/api/admin/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify(payload),
    });
  },
  generateMonth: async (payload) => {
    return await safeFetch("/api/admin/invoices/generate-month", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify(payload),
    });
  },
};

/* ===================== IssueInvoiceDropdown (inline) ===================== */
function IssueInvoiceDropdown({ onSuccess }) {
  const [open, setOpen] = useState(false);

  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // รายบุคคล
  const [tenantId, setTenantId] = useState("");
  const [periodYm, setPeriodYm] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [busyOne, setBusyOne] = useState(false);

  // ทั้งตึก
  const [gPeriod, setGPeriod] = useState("");
  const [gAmount, setGAmount] = useState("");
  const [gDue, setGDue] = useState("");
  const [busyGen, setBusyGen] = useState(false);

  useEffect(() => {
    if (!open || tenants.length) return;
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const list = await api.getTenants();
        setTenants(list.filter((t) => (t.is_deleted ?? 0) === 0 || t.is_deleted == null));
      } catch (e) {
        setErr(e.message || "โหลดผู้เช่าไม่สำเร็จ");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, tenants.length]);

  const submitOne = async (e) => {
    e.preventDefault();
    if (!tenantId || !periodYm || !amount || !dueDate) return alert("กรอกให้ครบ: ผู้เช่า/เดือนงวด/ยอดเงิน/กำหนดชำระ");
    try {
      setBusyOne(true);
      await api.createInvoice({
        tenant_id: tenantId,
        period_ym: periodYm,
        amount: Number(amount),
        due_date: dueDate,
      });
      alert("ออกใบแจ้งหนี้สำเร็จ");
      onSuccess?.();
    } catch (e) {
      alert(e.message || "ออกใบแจ้งหนี้ไม่สำเร็จ");
    } finally {
      setBusyOne(false);
    }
  };

  const submitGen = async (e) => {
    e.preventDefault();
    if (!gPeriod || !gAmount || !gDue) return alert("กรอกให้ครบ: เดือนงวด/ยอดมาตรฐาน/กำหนดชำระ");
    if (!window.confirm(`ยืนยันออกใบแจ้งหนี้ทั้งตึกสำหรับงวด ${gPeriod}?`)) return;
    try {
      setBusyGen(true);
      const res = await api.generateMonth({
        period_ym: gPeriod,
        amount_default: Number(gAmount),
        due_date: gDue,
        only_active: true,
      });
      alert(`สำเร็จ: สร้าง ${res.created ?? 0} รายการ, ข้าม ${res.skipped ?? 0} รายการ`);
      onSuccess?.();
    } catch (e) {
      alert(e.message || "สร้างใบแจ้งหนี้ทั้งตึกไม่สำเร็จ");
    } finally {
      setBusyGen(false);
    }
  };

  const card = {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    boxShadow: "0 6px 16px rgba(0,0,0,0.05)",
    padding: 12,
  };
  const label = { display: "block", fontWeight: 600, marginBottom: 6 };
  const input = { width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #e5e7eb" };
  const row = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 };

  return (
    <div style={{ marginBottom: 12 }}>
      <button
        type="button"
        className="btn"
        onClick={() => setOpen((v) => !v)}
        style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
      >
        <span style={{ transform: `rotate(${open ? 0 : -90}deg)`, transition: "transform .15s" }}>▾</span>
        ออกใบแจ้งหนี้
      </button>

      {open && (
        <div style={{ marginTop: 12 }}>
          {err && <p style={{ color: "#b91c1c" }}>{err}</p>}
          <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 12 }}>
            <section style={card}>
              <h3 style={{ marginTop: 0 }}>ออกใบแจ้งหนี้รายบุคคล</h3>
              <form onSubmit={submitOne}>
                <div style={{ marginBottom: 10 }}>
                  <label style={label}>ผู้เช่า</label>
                  <select value={tenantId} onChange={(e) => setTenantId(e.target.value)} style={input} disabled={loading}>
                    <option value="">— เลือกผู้เช่า —</option>
                    {tenants.map((t) => (
                      <option key={t.tenant_id} value={t.tenant_id}>
                        {(t.full_name || t.name || `Tenant#${t.tenant_id}`)} — ห้อง {t.room_id || "-"}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={row}>
                  <div>
                    <label style={label}>เดือนงวด (YYYY-MM)</label>
                    <input placeholder="2025-11" value={periodYm} onChange={(e) => setPeriodYm(e.target.value)} style={input} />
                  </div>
                  <div>
                    <label style={label}>กำหนดชำระ</label>
                    <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={input} />
                  </div>
                </div>

                <div style={{ marginTop: 10 }}>
                  <label style={label}>ยอดเงิน (บาท)</label>
                  <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} style={input} />
                </div>

                <div style={{ marginTop: 12 }}>
                  <button className="btn-primary" disabled={busyOne || loading}>
                    {busyOne ? "กำลังบันทึก..." : "ออกใบแจ้งหนี้"}
                  </button>
                </div>
              </form>
            </section>

            <section style={card}>
              <h3 style={{ marginTop: 0 }}>ออกใบแจ้งหนี้ทั้งตึก</h3>
              <form onSubmit={submitGen}>
                <div style={{ marginBottom: 10 }}>
                  <label style={label}>เดือนงวด (YYYY-MM)</label>
                  <input placeholder="2025-11" value={gPeriod} onChange={(e) => setGPeriod(e.target.value)} style={input} />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={label}>ยอดมาตรฐาน (บาท)</label>
                  <input type="number" step="0.01" value={gAmount} onChange={(e) => setGAmount(e.target.value)} style={input} />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={label}>กำหนดชำระ</label>
                  <input type="date" value={gDue} onChange={(e) => setGDue(e.target.value)} style={input} />
                </div>

                <button className="btn" disabled={busyGen || loading}>
                  {busyGen ? "กำลังสร้าง…" : "สร้างใบแจ้งหนี้ทั้งตึก"}
                </button>
                <p className="muted" style={{ marginTop: 8 }}>
                  ระบบจะสร้างให้เฉพาะผู้เช่าที่ <b>ยังไม่มี</b> ใบงวดนั้นอยู่แล้ว
                </p>
              </form>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

/* ===================== main AdminPaymentsPage ===================== */
export default function AdminPaymentsPage() {
  const [items, setItems] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [q, setQ] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      setErr("");
      const data = await api.getPending();
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(e.message || "โหลดรายการไม่สำเร็จ");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((r) =>
      String(r.tenant_name ?? "").toLowerCase().includes(s) ||
      String(r.tenant_room ?? "").toLowerCase().includes(s) ||
      String(r.period_ym ?? "").toLowerCase().includes(s)
    );
  }, [q, items]);

  const act = async (invoiceId, action) => {
    try {
      setBusyId(invoiceId);
      await api.decide(invoiceId, action);
      await load();
    } catch (e) {
      alert(e.message || "อัปเดตไม่สำเร็จ");
    } finally {
      setBusyId(null);
    }
  };

  const pageBg = { background: "#f8fafc", minHeight: "calc(100vh - 80px)" };
  const wrap = { maxWidth: 1100, margin: "24px auto", padding: 16 };
  const card = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, boxShadow: "0 6px 16px rgba(0,0,0,0.05)", padding: 16 };
  const th = { textAlign: "left", background: "#f3f4f6", color: "#111827", fontWeight: 700, padding: "12px 14px", borderBottom: "1px solid #e5e7eb" };
  const td = { padding: "12px 14px", borderBottom: "1px solid #f1f5f9", verticalAlign: "top" };
  const badge = (text) => ({
    display: "inline-block", padding: "4px 10px", borderRadius: 999, fontSize: 12,
    background: text === "pending" ? "#fff7ed" : text === "paid" ? "#ecfdf5" : text === "rejected" ? "#fef2f2" : "#eef2ff",
    color:      text === "pending" ? "#9a3412" : text === "paid" ? "#065f46" : text === "rejected" ? "#991b1b" : "#3730a3",
    border: "1px solid rgba(0,0,0,0.06)"
  });
  const isImage = (url = "") => /\.(png|jpe?g|webp|gif)$/i.test(url);

  return (
    <div style={pageBg}>
      <div style={wrap}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>ตรวจสอบการชำระเงินของผู้เช่า</h2>
          <input
            placeholder="ค้นหา: ชื่อ/ห้อง/เดือน"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ marginLeft: "auto", padding: "8px 10px", borderRadius: 8, border: "1px solid #e5e7eb", width: 260 }}
          />
        </div>

        {/* Dropdown: ออกใบแจ้งหนี้ */}
        <IssueInvoiceDropdown onSuccess={load} />

        <div style={card}>
          {loading && <p className="muted" style={{ margin: 0 }}>กำลังโหลดรายการ…</p>}
          {!loading && err && <p style={{ color: "#b91c1c", margin: 0 }}>{err}</p>}
          {!loading && !err && filtered.length === 0 && <p className="muted" style={{ margin: 0 }}>– ไม่มีรายการรอตรวจสอบ –</p>}

          {!loading && !err && filtered.length > 0 && (
            <div style={{ overflowX: "auto", borderRadius: 10 }}>
              <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
                <thead>
                  <tr>
                    <th style={th}>ลำดับ</th>
                    <th style={th}>ชื่อผู้เช่า</th>
                    <th style={th}>ห้อง</th>
                    <th style={th}>เดือน</th>
                    <th style={{ ...th, textAlign: "right" }}>ยอดชำระ</th>
                    <th style={th}>หลักฐานการโอน</th>
                    <th style={th}>สถานะ</th>
                    <th style={th}>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row, idx) => (
                    <tr key={row.invoice_id}>
                      <td style={td}>{idx + 1}</td>
                      <td style={td}>{row.tenant_name ?? `Tenant#${row.tenant_id}`}</td>
                      <td style={td}>{row.tenant_room ?? "-"}</td>
                      <td style={td}>{row.period_ym ?? "-"}</td>
                      <td style={{ ...td, textAlign: "right" }}>{Number(row.amount || 0).toLocaleString()}</td>
                      <td style={td}>
                        {row.slip_url ? (
                          isImage(row.slip_url) ? (
                            <a href={encodeURI(row.slip_url)} target="_blank" rel="noreferrer" title="เปิดสลิป">
                              <img src={encodeURI(row.slip_url)} alt="slip"
                                   style={{ width: 120, height: 90, objectFit: "cover", borderRadius: 8, border: "1px solid #e5e7eb" }} />
                            </a>
                          ) : (
                            <a href={encodeURI(row.slip_url)} target="_blank" rel="noreferrer">เปิดไฟล์</a>
                          )
                        ) : "—"}
                      </td>
                      <td style={td}><span style={badge(row.status)}>{row.status}</span></td>
                      <td style={td}>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            className="btn"
                            disabled={busyId === row.invoice_id}
                            onClick={() => act(row.invoice_id, "approve")}
                            title="อนุมัติการชำระเงิน"
                          >
                            ✅ อนุมัติ
                          </button>
                          <button
                            className="btn btn-danger"
                            disabled={busyId === row.invoice_id}
                            onClick={() => act(row.invoice_id, "reject")}
                            title="ปฏิเสธ"
                          >
                            ❌ ปฏิเสธ
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
