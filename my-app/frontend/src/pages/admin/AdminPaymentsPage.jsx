// frontend/src/pages/admin/AdminPaymentsPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getToken } from "../../utils/auth";

/* ===================== helper apis ===================== */
const api = {
  getPending: async () => {
    const token = getToken();
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const r = await fetch("/api/admin/invoices/pending", { headers, credentials: "include" });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d?.error || "โหลดรายการไม่สำเร็จ");
    return Array.isArray(d) ? d : [];
  },
  decide: async (id, action) => {
    const token = getToken();
    const r = await fetch(`/api/admin/invoices/${id}/decision`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: "include",
      body: JSON.stringify({ action }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d?.error || "อัปเดตไม่สำเร็จ");
    return d;
  },
};

/* ===================== utils ===================== */
const fmtTHB = (v) => {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return "-";
  try {
    return new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 2 }).format(n);
  } catch {
    return n.toFixed(2);
  }
};

const ymToThai = (ym) => {
  if (!ym) return "-";
  const m = String(ym).replace(/[^0-9]/g, "");
  let year, month;
  if (m.length >= 6) {
    year = Number(m.slice(0, 4));
    month = Number(m.slice(4, 6));
  } else {
    const parts = String(ym).split(/[-/_.\s]+/);
    if (parts.length >= 2) {
      year = Number(parts[0]);
      month = Number(parts[1]);
    }
  }
  if (!year || !month) return ym;
  const thMonths = ["-","ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
  return `${thMonths[month]} ${year + 543}`;
};

const isImage = (url = "") => /\.(png|jpe?g|webp|gif|bmp)$/i.test(url || "");
const normalizeUrl = (u = "") => { try { return u.includes("%25") ? decodeURIComponent(u) : u; } catch { return u; } };

/* ===================== page ===================== */
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
      setItems(data);
    } catch (e) {
      setErr(e.message || "โหลดรายการไม่สำเร็จ");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((r) => {
      const name = String(r.tenant_name ?? `Tenant#${r.tenant_id ?? ""}`).toLowerCase();
      const room = String(r.tenant_room ?? r.room_no ?? "").toLowerCase();
      const ym = String(r.period_ym ?? r.billing_month ?? "").toLowerCase();
      return name.includes(s) || room.includes(s) || ym.includes(s);
    });
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

  // ---- styles ----
  const pageBg = { background: "#f8fafc", minHeight: "calc(100vh - 80px)" };
  const wrap = { maxWidth: 1100, margin: "24px auto", padding: 16 };
  const card = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, boxShadow: "0 6px 16px rgba(0,0,0,0.05)", padding: 16 };
  const th = { textAlign: "left", background: "#f3f4f6", color: "#111827", fontWeight: 700, padding: "12px 14px", borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap" };
  const td = { padding: "12px 14px", borderBottom: "1px solid #f1f5f9", verticalAlign: "top" };
  const badge = (text) => ({
    display: "inline-block", padding: "4px 10px", borderRadius: 999, fontSize: 12,
    background: text === "pending" ? "#fff7ed" : text === "paid" ? "#ecfdf5" : text === "rejected" ? "#fef2f2" : "#eef2ff",
    color:      text === "pending" ? "#9a3412" : text === "paid" ? "#065f46" : text === "rejected" ? "#991b1b" : "#3730a3",
    border: "1px solid rgba(0,0,0,0.06)", textTransform: "capitalize",
  });
  const baseBtn = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, minWidth: 108, height: 36, padding: "0 12px", borderRadius: 10, fontWeight: 700, border: "1px solid transparent", transition: "transform .05s ease, opacity .15s ease", cursor: "pointer", userSelect: "none" };
  const btnApprove = { ...baseBtn, background: "#ecfdf5", color: "#065f46", borderColor: "rgba(16,185,129,.35)" };
  const btnReject  = { ...baseBtn, background: "#fef2f2", color: "#991b1b", borderColor: "rgba(239,68,68,.35)" };
  const btnDisabled = { opacity: 0.55, cursor: "not-allowed", transform: "none" };

  return (
    <div style={pageBg}>
      <div style={wrap}>
        {/* ===== แถบหัวข้อ / ค้นหา / ปุ่มกลับไปฟอร์ม ===== */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap", width: "100%" }}>
          <h2 style={{ margin: 0 }}>ตรวจสอบการชำระเงินของผู้เช่า</h2>

          <Link
            to="/admin/payments"
            className="btn"
            style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 12px", border: "1px solid #e5e7eb", borderRadius: 8, textDecoration: "none", background: "#fff" }}
            title="ไปยังหน้าออกใบแจ้งหนี้ (ฟอร์ม)"
          >
            ↩ ออกใบแจ้งหนี้ (ฟอร์ม)
          </Link>

          <input
            placeholder="ค้นหา: ชื่อ/ห้อง/เดือน"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ marginLeft: "auto", padding: "8px 10px", borderRadius: 8, border: "1px solid #e5e7eb", width: 260 }}
          />
        </div>

        {/* ===== ตารางรายการ ===== */}
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
                  {filtered.map((row, idx) => {
                    const id = row.invoice_id ?? row.bill_id ?? row.id ?? `${idx}`;
                    const name = row.tenant_name ?? `Tenant#${row.tenant_id ?? "-"}`;
                    const room = row.tenant_room ?? row.room_no ?? "-";
                    const ym = ymToThai(row.period_ym ?? row.billing_month);
                    const amount = fmtTHB(row.amount ?? row.total ?? row.rent);
                    const rawSlip = row.slip_abs || row.slip_url || row.slip || "";
                    const slip = normalizeUrl(rawSlip);
                    const status = row.status ?? "pending";

                    return (
                      <tr key={id}>
                        <td style={td}>{idx + 1}</td>
                        <td style={td}>{name}</td>
                        <td style={td}>{room}</td>
                        <td style={td}>{ym}</td>
                        <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>{amount}</td>
                        <td style={td}>
                          {slip ? (
                            isImage(slip) ? (
                              <a href={slip} target="_blank" rel="noreferrer" title="เปิดสลิป">
                                <img src={slip} alt="slip" style={{ width: 120, height: 90, objectFit: "cover", borderRadius: 8, border: "1px solid #e5e7eb" }} />
                              </a>
                            ) : <a href={slip} target="_blank" rel="noreferrer">เปิดไฟล์</a>
                          ) : "—"}
                        </td>
                        <td style={td}><span style={badge(status)}>{status}</span></td>
                        <td style={td}>
                          <div style={{ display: "flex", gap: 10 }}>
                            <button
                              style={{ ...(busyId === id ? { ...btnApprove, ...btnDisabled } : btnApprove) }}
                              disabled={busyId === id}
                              onClick={() => act(id, "approve")}
                              title="อนุมัติการชำระเงิน"
                              aria-label="อนุมัติ"
                            >
                              <span aria-hidden>✅</span><span>อนุมัติ</span>
                            </button>
                            <button
                              style={{ ...(busyId === id ? { ...btnReject, ...btnDisabled } : btnReject) }}
                              disabled={busyId === id}
                              onClick={() => act(id, "reject")}
                              title="ปฏิเสธการชำระเงิน"
                              aria-label="ปฏิเสธ"
                            >
                              <span aria-hidden>✖</span><span>ปฏิเสธ</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
