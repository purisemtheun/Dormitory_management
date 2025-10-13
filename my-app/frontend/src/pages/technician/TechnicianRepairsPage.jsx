import React, { useEffect, useMemo, useState } from "react";
import { getToken } from "../../utils/auth";

/* ---------------- API helpers ---------------- */
const api = {
  listMyRepairs: async () => {
    const r = await fetch("/api/tech/repairs", {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d?.error || "โหลดงานของฉันไม่สำเร็จ");
    // เผื่อ backend ส่งงานทั้งหมดมา เราจะกรองด้านหน้าไว้ให้เหลือ ASSIGNED/IN_PROGRESS
    const arr = Array.isArray(d) ? d : [];
    return arr.filter(
      (x) => ["assigned", "in_progress"].includes(String(x.status || "").toLowerCase())
    );
  },

  start: async (repairId) => {
    const r = await fetch(`/api/tech/repairs/${encodeURIComponent(repairId)}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify({ action: "start" }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d?.error || "เริ่มงานไม่สำเร็จ");
    return d;
  },

  complete: async (repairId) => {
    const r = await fetch(`/api/tech/repairs/${encodeURIComponent(repairId)}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify({ action: "complete" }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d?.error || "เสร็จสิ้นงานไม่สำเร็จ");
    return d;
  },
};

/* ---------------- UI helpers ---------------- */
const badgeStyle = (s) => {
  const m = String(s || "").toLowerCase();
  const bg =
    m === "assigned" ? "#eef2ff" :
    m === "in_progress" ? "#fff7ed" :
    m === "done" ? "#ecfdf5" : "#f3f4f6";
  const color =
    m === "assigned" ? "#3730a3" :
    m === "in_progress" ? "#9a3412" :
    m === "done" ? "#065f46" : "#374151";
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
    return items.filter((r) =>
      String(r.room_no || r.room_id || "").toLowerCase().includes(s) ||
      String(r.title || "").toLowerCase().includes(s) ||
      String(r.tenant_name || "").toLowerCase().includes(s) ||
      String(r.status || "").toLowerCase().includes(s)
    );
  }, [items, q]);

  const onStart = async (rid) => {
    try {
      setBusyId(rid);
      await api.start(rid);
      // อัปเดตสถานะใน list ทันที (หรือจะ reload ก็ได้)
      setItems((lst) =>
        lst.map((x) => (x.repair_id === rid ? { ...x, status: "in_progress" } : x))
      );
    } catch (e) {
      alert(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const onComplete = async (rid) => {
    if (!window.confirm("ยืนยันเสร็จสิ้นงานนี้?")) return;
    try {
      setBusyId(rid);
      await api.complete(rid);
      // เสร็จสิ้นแล้วลบออกจากรายการทันที
      setItems((lst) => lst.filter((x) => x.repair_id !== rid));
    } catch (e) {
      alert(e.message);
    } finally {
      setBusyId(null);
    }
  };

  /* ------------ Layout style ------------ */
  const pageBg = { background: "#f8fafc", minHeight: "calc(100vh - 80px)" };
  const wrap = { maxWidth: 1100, margin: "24px auto", padding: 16 };
  const card = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, boxShadow: "0 6px 16px rgba(0,0,0,.05)", padding: 16 };
  const th = { textAlign: "left", background: "#f3f4f6", fontWeight: 700, padding: "12px 14px", borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap" };
  const td = { padding: "12px 14px", borderBottom: "1px solid #f1f5f9", verticalAlign: "top" };

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
                    const room = r.room_no || r.room_id || "-";
                    const reporter = r.tenant_name || "-";
                    const canStart = status === "assigned";
                    const canComplete = status === "in_progress";
                    return (
                      <tr key={r.repair_id}>
                        <td style={td}>{idx + 1}</td>
                        <td style={td}>{room}</td>
                        <td style={td}>{r.title || "-"}</td>
                        <td style={td}>{r.description || "-"}</td>
                        <td style={td}>{reporter}</td>
                        <td style={td}>{r.created_at ? String(r.created_at).replace("T"," ").slice(0,16) : "-"}</td>
                        <td style={td}><span style={badgeStyle(status)}>{status.toUpperCase()}</span></td>
                        <td style={td}>
                          {canStart && (
                            <button
                              className="btn"
                              disabled={busyId === r.repair_id}
                              onClick={() => onStart(r.repair_id)}
                            >
                              ▶️ เริ่มงาน
                            </button>
                          )}
                          {canComplete && (
                            <button
                              className="btn"
                              disabled={busyId === r.repair_id}
                              onClick={() => onComplete(r.repair_id)}
                              style={{ marginLeft: 8 }}
                            >
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
