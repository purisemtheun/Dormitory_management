// frontend/src/pages/admin/AdminPaymentsPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, Outlet } from "react-router-dom";
import { getToken } from "../../utils/auth";

/* ===================== helper apis ===================== */
const api = {
  getPending: async () => {
    const r = await fetch("/api/admin/invoices/pending", {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d?.error || "โหลดรายการไม่สำเร็จ");
    return Array.isArray(d) ? d : [];
  },
  decide: async (id, action) => {
    const r = await fetch(`/api/admin/invoices/${id}/decision`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify({ action }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d?.error || "อัปเดตไม่สำเร็จ");
    return d;
  },
};

export default function AdminPaymentsPage() {
  const [items, setItems] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [q, setQ] = useState("");

  const load = async () => {
    try {
      setLoading(true); setErr("");
      const data = await api.getPending();
      setItems(data);
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
    return items.filter(
      (r) =>
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
      alert(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const pageBg = { background: "#f8fafc", minHeight: "calc(100vh - 80px)" };
  const wrap = { maxWidth: 1100, margin: "24px auto", padding: 16 };
  const card = {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    boxShadow: "0 6px 16px rgba(0,0,0,0.05)",
    padding: 16,
  };
  const th = {
    textAlign: "left",
    background: "#f3f4f6",
    color: "#111827",
    fontWeight: 700,
    padding: "12px 14px",
    borderBottom: "1px solid #e5e7eb",
  };
  const td = { padding: "12px 14px", borderBottom: "1px solid #f1f5f9", verticalAlign: "top" };
  const badge = (text) => ({
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    background: text === "pending" ? "#fff7ed" : text === "paid" ? "#ecfdf5" : text === "rejected" ? "#fef2f2" : "#eef2ff",
    color: text === "pending" ? "#9a3412" : text === "paid" ? "#065f46" : text === "rejected" ? "#991b1b" : "#3730a3",
    border: "1px solid rgba(0,0,0,0.06)",
  });
  const isImage = (url = "") => /\.(png|jpe?g|webp|gif)$/i.test(url);

  return (
    <div style={pageBg}>
      <div style={wrap}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>ตรวจสอบการชำระเงินของผู้เช่า</h2>

          {/* ปุ่มไปหน้าออกใบแจ้งหนี้ (subpage) */}
          <div style={{ marginLeft: 12 }}>
            <Link to="issue" className="btn" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              ▾ ออกใบแจ้งหนี้ (หน้าเต็ม)
            </Link>
          </div>

          <input
            placeholder="ค้นหา: ชื่อ/ห้อง/เดือน"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ marginLeft: "auto", padding: "8px 10px", borderRadius: 8, border: "1px solid #e5e7eb", width: 260 }}
          />
        </div>

        <div style={card}>
          {loading && (
            <p className="muted" style={{ margin: 0 }}>
              กำลังโหลดรายการ…
            </p>
          )}
          {!loading && err && (
            <p style={{ color: "#b91c1c", margin: 0 }}>
              {err}
            </p>
          )}
          {!loading && !err && filtered.length === 0 && (
            <p className="muted" style={{ margin: 0 }}>
              – ไม่มีรายการรอตรวจสอบ –
            </p>
          )}

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
                              <img
                                src={encodeURI(row.slip_url)}
                                alt="slip"
                                style={{ width: 120, height: 90, objectFit: "cover", borderRadius: 8, border: "1px solid #e5e7eb" }}
                              />
                            </a>
                          ) : (
                            <a href={encodeURI(row.slip_url)} target="_blank" rel="noreferrer">
                              เปิดไฟล์
                            </a>
                          )
                        ) : (
                          "—"
                        )}
                      </td>
                      <td style={td}>
                        <span style={badge(row.status)}>{row.status}</span>
                      </td>
                      <td style={td}>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button className="btn" disabled={busyId === row.invoice_id} onClick={() => act(row.invoice_id, "approve")} title="อนุมัติการชำระเงิน">
                            ✅ อนุมัติ
                          </button>
                          <button className="btn btn-danger" disabled={busyId === row.invoice_id} onClick={() => act(row.invoice_id, "reject")} title="ปฏิเสธ">
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

        {/* ---------- ที่นี่คือจุดที่ subpage (AdminInvoiceCreatePage) จะถูก render ---------- */}
        <div style={{ marginTop: 16 }}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
