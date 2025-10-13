// src/pages/admin/AdminRepairManagement.jsx
import React, { useEffect, useMemo, useState } from "react";
import { getToken } from "../../utils/auth";

/* -------- API helpers -------- */
const api = {
  listRepairs: async () => {
    const r = await fetch("/api/repairs", {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d?.error || "โหลดรายการซ่อมไม่สำเร็จ");
    return Array.isArray(d) ? d : [];
  },

  listTechnicians: async () => {
    const headers = { Authorization: `Bearer ${getToken()}` };
    const tryOnce = async (url) => {
      const r = await fetch(url, { headers });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || `GET ${url} failed`);
      const arr = Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : []);
      return arr.map((x) => ({
        id: x.id,
        name: x.name || `Tech#${x.id}`,
      }));
    };
    try {
      return await tryOnce("/api/repairs/technicians");
    } catch {
      try {
        return await tryOnce("/api/technicians");
      } catch {
        return [];
      }
    }
  },

  // มอบหมายงานให้ช่าง
  assign: async (repairId, techId) => {
    const r = await fetch(`/api/repairs/${encodeURIComponent(repairId)}/assign`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify({ assigned_to: Number(techId) }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d?.error || "มอบหมายงานไม่สำเร็จ");
    return d;
  },

  // ลบงาน (ปฏิเสธ)
  deleteRepair: async (repairId) => {
    const r = await fetch(`/api/repairs/${encodeURIComponent(repairId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d?.error || "ลบงานไม่สำเร็จ");
    return d;
  },
};

const badge = (s) => ({
  display: "inline-block",
  padding: "4px 10px",
  borderRadius: 999,
  fontSize: 12,
  border: "1px solid rgba(0,0,0,.06)",
  background:
    s === "new" ? "#eef2ff" :
    s === "in_progress" ? "#fff7ed" :
    s === "done" ? "#ecfdf5" :
    s === "rejected" ? "#fef2f2" : "#f3f4f6",
  color:
    s === "new" ? "#3730a3" :
    s === "in_progress" ? "#9a3412" :
    s === "done" ? "#065f46" :
    s === "rejected" ? "#991b1b" : "#374151",
});

export default function AdminRepairManagement() {
  const [items, setItems] = useState([]);
  const [techs, setTechs] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [q, setQ] = useState("");
  const [assignSel, setAssignSel] = useState({}); // {repair_id: techId}

  const load = async () => {
    try {
      setLoading(true);
      setErr("");
      const [rps, tcs] = await Promise.all([api.listRepairs(), api.listTechnicians()]);
      setItems(rps);
      setTechs(tcs);
      const init = {};
      rps.forEach((r) => { if (r.assigned_to) init[r.repair_id] = r.assigned_to; });
      setAssignSel(init);
    } catch (e) {
      setErr(e.message || "โหลดข้อมูลไม่สำเร็จ");
      setItems([]);
      setTechs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // ✅ แสดงเฉพาะงานที่ "ยังไม่ถูกมอบหมาย" (status = new) เท่านั้น
  const visible = useMemo(() => {
    const s = q.trim().toLowerCase();
    const base = items.filter((r) => String(r.status || "").toLowerCase() === "new");
    if (!s) return base;
    return base.filter((r) =>
      String(r.repair_id).toLowerCase().includes(s) ||
      String(r.title || "").toLowerCase().includes(s) ||
      String(r.room_id || "").toLowerCase().includes(s) ||
      String(r.technician_name || "").toLowerCase().includes(s)
    );
  }, [items, q]);

  // ✅ มอบหมายแล้ว ซ่อนแถวทันที (ไม่ reload ทั้งหน้า)
  const assign = async (rid) => {
    const techId = assignSel[rid];
    if (!techId) return alert("กรุณาเลือกช่างก่อนมอบหมาย");
    try {
      setBusyId(rid);
      await api.assign(rid, techId);
      // ลบออกจากตารางทันที
      setItems((list) => list.filter((x) => x.repair_id !== rid));
    } catch (e) {
      alert(e.message);
    } finally {
      setBusyId(null);
    }
  };

  // ✅ ปฏิเสธ = ลบงานออกจากระบบ (และลบออกจากตารางทันที)
  const reject = async (rid) => {
    if (!window.confirm("ยืนยันลบงานนี้ทิ้งถาวร?")) return;
    try {
      setBusyId(rid);
      await api.deleteRepair(rid);
      setItems((list) => list.filter((x) => x.repair_id !== rid));
    } catch (e) {
      alert(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const pageBg = { background: "#f8fafc", minHeight: "calc(100vh - 80px)" };
  const wrap = { maxWidth: 1200, margin: "24px auto", padding: 16 };
  const card = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, boxShadow: "0 6px 16px rgba(0,0,0,.05)", padding: 16 };
  const th = { textAlign: "left", background: "#f3f4f6", fontWeight: 700, padding: "12px 14px", borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap" };
  const td = { padding: "12px 14px", borderBottom: "1px solid #f1f5f9", verticalAlign: "top" };

  return (
    <div style={pageBg}>
      <div style={wrap}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>จัดการงานซ่อม</h2>
          <input
            placeholder="ค้นหา: รหัส/หัวข้อ/ห้อง/ช่าง"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ marginLeft: "auto", padding: "8px 10px", borderRadius: 8, border: "1px solid #e5e7eb", width: 280 }}
          />
        </div>

        <div style={card}>
          {loading && <p className="muted" style={{ margin: 0 }}>กำลังโหลดรายการ…</p>}
          {!loading && err && <p style={{ color: "#b91c1c", margin: 0 }}>{err}</p>}
          {!loading && !err && visible.length === 0 && <p className="muted" style={{ margin: 0 }}>– ไม่มีรายการ –</p>}

          {!loading && !err && visible.length > 0 && (
            <div style={{ overflowX: "auto", borderRadius: 10 }}>
              <table style={{ width: "100%", minWidth: 1000, borderCollapse: "separate", borderSpacing: 0 }}>
                <thead>
                  <tr>
                    <th style={{ ...th, width: 80 }}>รหัส</th>
                    <th style={{ ...th, width: 260 }}>หัวข้อ</th>
                    <th style={{ ...th, width: 90 }}>ห้อง</th>
                    <th style={{ ...th, width: 120 }}>กำหนด</th>
                    <th style={{ ...th, width: 120 }}>สถานะ</th>
                    <th style={{ ...th, width: 160 }}>ช่างที่มอบหมาย</th>
                    <th style={{ ...th, width: 220 }}>มอบหมายงาน</th>
                    <th style={{ ...th, width: 140 }}>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => (
                    <tr key={r.repair_id}>
                      <td style={td}>{r.repair_id}</td>
                      <td style={td}>
                        <div style={{ fontWeight: 700 }}>{r.title}</div>
                        <div style={{ opacity: .7, fontSize: 13 }}>{r.description}</div>
                        {r.image_url ? (
                          <div style={{ marginTop: 6 }}>
                            <a href={encodeURI(r.image_url)} target="_blank" rel="noreferrer">ดูรูป</a>
                          </div>
                        ) : null}
                      </td>
                      <td style={td}>{r.room_id || "-"}</td>
                      <td style={td}>{r.due_date ? String(r.due_date).slice(0,10) : "-"}</td>
                      <td style={td}><span style={badge(r.status)}>{r.status}</span></td>
                      <td style={td}>{r.technician_name || (r.assigned_to ? `Tech#${r.assigned_to}` : "—")}</td>
                      <td style={td}>
                        <select
                          disabled={busyId === r.repair_id || loading}
                          value={assignSel[r.repair_id] ?? ""}
                          onChange={(e) => setAssignSel((s) => ({ ...s, [r.repair_id]: e.target.value }))}
                          onMouseDown={(e) => e.stopPropagation()}
                          style={{
                            width: "100%",
                            padding: "8px 10px",
                            borderRadius: 8,
                            border: "1px solid #e5e7eb",
                          }}
                        >
                          {loading ? (
                            <option value="">— กำลังโหลดรายชื่อช่าง... —</option>
                          ) : techs.length === 0 ? (
                            <option value="">— ไม่มีช่าง —</option>
                          ) : (
                            <>
                              <option value="">— เลือกช่าง —</option>
                              {techs.map((t) => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                              ))}
                            </>
                          )}
                        </select>
                      </td>
                      <td style={td}>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            className="btn"
                            disabled={busyId === r.repair_id || techs.length === 0 || !assignSel[r.repair_id]}
                            onClick={() => assign(r.repair_id)}
                            title="มอบหมายช่าง"
                          >
                            🧰 มอบหมาย
                          </button>
                          <button
                            className="btn btn-danger"
                            disabled={busyId === r.repair_id}
                            onClick={() => reject(r.repair_id)}
                            title="ปฏิเสธ (ลบงานนี้)"
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
