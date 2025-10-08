// frontend/src/pages/technician/TechnicianRepairsPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { getToken } from "../../utils/auth";

/** ============ safe fetch helpers ============ */
async function parseResponseSafe(res) {
  const txt = await res.text();
  try { return txt ? JSON.parse(txt) : null; } catch { return txt; }
}
async function safeFetch(url, opts = {}) {
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

/** ============ APIs (ปรับ endpoint ให้ตรง backend ถ้าใช้ชื่อไม่เหมือน) ============ */
const api = {
  // โหลดรายการแจ้งซ่อมสำหรับช่าง (ทั้งหมด หรือเฉพาะที่ assign ให้ช่างที่ล็อกอิน)
  // ตัวอย่าง endpoint: /api/tech/repairs
  listRepairs: () =>
    safeFetch("/api/tech/repairs", {
      headers: { Authorization: `Bearer ${getToken()}` },
      credentials: "include",
    }),
  // อัปเดตสถานะ: action = 'start' | 'complete'
  updateStatus: (id, action) =>
    safeFetch(`/api/tech/repairs/${id}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
      credentials: "include",
      body: JSON.stringify({ action }),
    }),
};

/** ============ utils ============ */
const fmtDateTime = (s) => {
  if (!s) return "-";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
};

const STATUS_TEXT = {
  pending: "รอดำเนินการ",
  in_progress: "กำลังซ่อม",
  completed: "เสร็จสิ้น",
};

export default function TechnicianRepairsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [q, setQ] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      setErr("");
      const data = await api.listRepairs();
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
    return items.filter((r) => {
      const room = String(r.room_no ?? r.room ?? "").toLowerCase();
      const title = String(r.title ?? r.issue ?? "").toLowerCase();
      const desc = String(r.description ?? r.detail ?? "").toLowerCase();
      const tenant = String(r.tenant_name ?? "").toLowerCase();
      const status = String(r.status ?? "").toLowerCase();
      return room.includes(s) || title.includes(s) || desc.includes(s) || tenant.includes(s) || status.includes(s);
    });
  }, [q, items]);

  const act = async (repairId, action) => {
    try {
      setBusyId(repairId);
      await api.updateStatus(repairId, action);
      await load();
    } catch (e) {
      alert(e.message || "อัปเดตสถานะไม่สำเร็จ");
    } finally {
      setBusyId(null);
    }
  };

  /** -------- styles (โทนเดียวกับโปรเจกต์) -------- */
  const pageBg = { background: "#f8fafc", minHeight: "calc(100vh - 80px)" };
  const wrap = { maxWidth: 1100, margin: "24px auto", padding: 16 };
  const card = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, boxShadow: "0 6px 16px rgba(0,0,0,.05)", padding: 16 };
  const th = { textAlign: "left", background: "#f3f4f6", color: "#111827", fontWeight: 700, padding: "12px 14px", borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap" };
  const td = { padding: "12px 14px", borderBottom: "1px solid #f1f5f9", verticalAlign: "top" };
  const badge = (status) => {
    const m = {
      pending: { bg: "#fff7ed", color: "#9a3412" },
      in_progress: { bg: "#eff6ff", color: "#1d4ed8" },
      completed: { bg: "#ecfdf5", color: "#065f46" },
    }[status] || { bg: "#eef2ff", color: "#3730a3" };
    return {
      display: "inline-block",
      padding: "4px 10px",
      borderRadius: 999,
      fontSize: 12,
      background: m.bg,
      color: m.color,
      border: "1px solid rgba(0,0,0,0.06)",
      textTransform: "none",
    };
  };

  const baseBtn = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minWidth: 120,
    height: 36,
    padding: "0 12px",
    borderRadius: 10,
    fontWeight: 700,
    border: "1px solid transparent",
    cursor: "pointer",
    userSelect: "none",
    transition: "transform .05s ease, opacity .15s ease",
  };
  const btnStart = { ...baseBtn, background: "#eff6ff", color: "#1d4ed8", borderColor: "rgba(59,130,246,.35)" };
  const btnDone = { ...baseBtn, background: "#ecfdf5", color: "#065f46", borderColor: "rgba(16,185,129,.35)" };
  const btnDisabled = { opacity: .55, cursor: "not-allowed", transform: "none" };

  return (
    <div style={pageBg}>
      <div style={wrap}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
          <h2 style={{ margin: 0 }}>งานซ่อมของฉัน</h2>
          <input
            placeholder="ค้นหา: ห้อง/เรื่อง/คำอธิบาย/ผู้เช่า/สถานะ"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ marginLeft: "auto", padding: "8px 10px", borderRadius: 8, border: "1px solid #e5e7eb", width: 320 }}
          />
        </div>

        <div style={card}>
          {loading && <p className="muted" style={{ margin: 0 }}>กำลังโหลดรายการ…</p>}
          {!loading && err && <p style={{ color: "#b91c1c", margin: 0 }}>{err}</p>}
          {!loading && !err && filtered.length === 0 && <p className="muted" style={{ margin: 0 }}>– ยังไม่มีงานซ่อม –</p>}

          {!loading && !err && filtered.length > 0 && (
            <div style={{ overflowX: "auto", borderRadius: 10 }}>
              <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
                <thead>
                  <tr>
                    <th style={th}>ลำดับ</th>
                    <th style={th}>ห้อง</th>
                    <th style={th}>เรื่อง</th>
                    <th style={th}>รายละเอียด</th>
                    <th style={th}>ผู้แจ้ง</th>
                    <th style={th}>แจ้งเมื่อ</th>
                    <th style={th}>สถานะ</th>
                    <th style={th}>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => {
                    const id = r.repair_id ?? r.id ?? i;
                    const status = r.status ?? "pending";
                    return (
                      <tr key={id}>
                        <td style={td}>{i + 1}</td>
                        <td style={td}>{r.room_no ?? "-"}</td>
                        <td style={td}>{r.title ?? r.issue ?? "-"}</td>
                        <td style={td}>{r.description ?? r.detail ?? "-"}</td>
                        <td style={td}>{r.tenant_name ?? "-"}</td>
                        <td style={td}>{fmtDateTime(r.reported_at ?? r.created_at)}</td>
                        <td style={td}><span style={badge(status)}>{STATUS_TEXT[status] ?? status}</span></td>
                        <td style={td}>
                          {/* สถานะแรก: pending → ปุ่มเริ่มซ่อม */}
                          {status === "pending" && (
                            <button
                              style={busyId === id ? { ...btnStart, ...btnDisabled } : btnStart}
                              disabled={busyId === id}
                              onClick={() => act(id, "start")}
                              title="เริ่มซ่อม"
                            >
                              เริ่มซ่อม
                            </button>
                          )}

                          {/* สถานะกลาง: in_progress → ปุ่มเสร็จสิ้น */}
                          {status === "in_progress" && (
                            <button
                              style={busyId === id ? { ...btnDone, ...btnDisabled } : btnDone}
                              disabled={busyId === id}
                              onClick={() => act(id, "complete")}
                              title="ทำเสร็จแล้ว"
                            >
                              เสร็จสิ้น
                            </button>
                          )}

                          {/* สถานะสุดท้าย: completed → ไม่มีปุ่ม */}
                          {status === "completed" && <span style={{ color: "#059669", fontWeight: 600 }}>✔ เสร็จสิ้นแล้ว</span>}
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
