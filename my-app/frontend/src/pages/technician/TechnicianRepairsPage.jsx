// frontend/src/pages/technician/TechnicianRepairsPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import http from "../../services/http";
import { getToken } from "../../utils/auth";

/* ---------------- API helpers (ใช้ axios instance เดิม) ---------------- */
const api = {
  listMyRepairs: async () => {
    const r = await http.get("/api/repairs/tech", {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    // backend คืน array
    return Array.isArray(r.data) ? r.data.filter(x =>
      ["assigned", "in_progress"].includes(String(x.status || "").toLowerCase())
    ) : [];
  },

  start: async (repairId) => {
    const r = await http.patch(`/api/repairs/tech/${encodeURIComponent(repairId)}/status`,
      { action: "start" },
      { headers: { Authorization: `Bearer ${getToken()}` } }
    );
    return r.data;
  },

  complete: async (repairId) => {
    const r = await http.patch(`/api/repairs/tech/${encodeURIComponent(repairId)}/status`,
      { action: "complete" },
      { headers: { Authorization: `Bearer ${getToken()}` } }
    );
    return r.data;
  },
};

/* ---------------- UI helpers ---------------- */
const badgeStyle = (s) => {
  const m = String(s || "").toLowerCase();
  const bg =
    m === "assigned"   ? "#eef2ff" :
    m === "in_progress"? "#fff7ed" :
    m === "done"       ? "#ecfdf5" : "#f3f4f6";
  const color =
    m === "assigned"   ? "#3730a3" :
    m === "in_progress"? "#9a3412" :
    m === "done"       ? "#065f46" : "#374151";
  return {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    border: "1px solid rgba(0,0,0,.06)",
    background: bg,
    color,
  };
};

export default function TechnicianRepairs() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [err, setErr] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      setErr("");
      const arr = await api.listMyRepairs();
      setItems(arr);
    } catch (e) {
      setErr(e?.message || "โหลดรายการไม่สำเร็จ");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter(r =>
      String(r.room_no || r.room_id || "").toLowerCase().includes(s) ||
      String(r.title || "").toLowerCase().includes(s) ||
      String(r.tenant_name || "").toLowerCase().includes(s) ||
      String(r.status || "").toLowerCase().includes(s)
    );
  }, [items, q]);

  const getKey = (r) => r.repair_id ?? r.id;

  const onStart = async (rid) => {
    try {
      setBusyId(rid);
      await api.start(rid);
      setItems(lst => lst.map(x =>
        getKey(x) === rid ? { ...x, status: "in_progress" } : x
      ));
    } catch (e) {
      alert(e?.message || "เริ่มงานไม่สำเร็จ");
    } finally {
      setBusyId(null);
    }
  };

  const onComplete = async (rid) => {
    if (!window.confirm("ยืนยันเสร็จสิ้นงานนี้?")) return;
    try {
      setBusyId(rid);
      await api.complete(rid);
      setItems(lst => lst.filter(x => getKey(x) !== rid));
    } catch (e) {
      alert(e?.message || "เสร็จสิ้นงานไม่สำเร็จ");
    } finally {
      setBusyId(null);
    }
  };

  const pageBg = { background: "#f8fafc", minHeight: "calc(100vh - 80px)" };
  const wrap   = { maxWidth: 1100, margin: "24px auto", padding: 16 };
  const card   = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, boxShadow: "0 6px 16px rgba(0,0,0,.05)", padding: 16 };
  const th     = { textAlign: "left", background: "#f3f4f6", fontWeight: 700, padding: "12px 14px", borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap" };
  const td     = { padding: "12px 14px", borderBottom: "1px solid #f1f5f9", verticalAlign: "top" };

  return (
    <div style={pageBg}>
      <div style={wrap}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>งานซ่อมของฉัน</h2>
          <input
            placeholder="ค้นหา: ห้อง/เรื่อง/ผู้แจ้ง/สถานะ"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ marginLeft: "auto", padding: "8px 10px", borderRadius: 8, border: "1px solid #e5e7eb", width: 300 }}
          />
        </div>

        <div style={card}>
          {loading && <p style={{ margin: 0 }}>กำลังโหลดรายการ…</p>}
          {!loading && err && <p style={{ color: "#b91c1c", margin: 0 }}>{err}</p>}
          {!loading && !err && filtered.length === 0 && <p style={{ margin: 0, opacity: .7 }}>– ไม่มีงานซ่อม –</p>}

          {!loading && !err && filtered.length > 0 && (
            <div style={{ overflowX: "auto", borderRadius: 10 }}>
              <table style={{ width: "100%", minWidth: 900, borderCollapse: "separate", borderSpacing: 0 }}>
                <thead>
                  <tr>
                    <th style={{ ...th, width: 60 }}>ลำดับ</th>
                    <th style={{ ...th, width: 90 }}>ห้อง</th>
                    <th style={{ ...th, width: 200 }}>เรื่อง</th>
                    <th style={{ ...th, width: 220 }}>รายละเอียด</th>
                    <th style={{ ...th, width: 140 }}>ผู้แจ้ง</th>
                    <th style={{ ...th, width: 160 }}>แจ้งเมื่อ</th>
                    <th style={{ ...th, width: 120 }}>สถานะ</th>
                    <th style={{ ...th, width: 160 }}>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, idx) => {
                    const status = String(r.status || "").toLowerCase();
                    const rid = getKey(r);
                    const room = r.room_no || r.room_id || "-";
                    const reporter = r.tenant_name || "-";
                    const canStart = status === "assigned";
                    const canComplete = status === "in_progress";
                    return (
                      <tr key={rid}>
                        <td style={td}>{idx + 1}</td>
                        <td style={td}>{room}</td>
                        <td style={td}>{r.title || "-"}</td>
                        <td style={td}>{r.description || "-"}</td>
                        <td style={td}>{reporter}</td>
                        <td style={td}>{r.created_at ? String(r.created_at).replace("T"," ").slice(0,16) : "-"}</td>
                        <td style={td}><span style={badgeStyle(status)}>{status.toUpperCase()}</span></td>
                        <td style={td}>
                          {canStart && (
                            <button className="btn" disabled={busyId === rid} onClick={() => onStart(rid)}>
                              ▶️ เริ่มงาน
                            </button>
                          )}
                          {canComplete && (
                            <button className="btn" disabled={busyId === rid} onClick={() => onComplete(rid)} style={{ marginLeft: 8 }}>
                              ✅ เสร็จสิ้น
                            </button>
                          )}
                          {!canStart && !canComplete && <span style={{ opacity: .6 }}>—</span>}
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
