import React, { useMemo, useState } from "react";

/* ================== Room helpers ================== */
const getRoomId = (r = {}) =>
  String(r.room_id ?? r.roomId ?? r.room_code ?? r.roomCode ?? "").trim();
const getRoomNo = (r = {}) =>
  String(r.room_number ?? r.roomNumber ?? r.room_no ?? r.number ?? "").trim();

/** เดาเลขห้องจากทุกคีย์ที่มีคำว่า "room" (รวมอ็อบเจ็กต์ซ้อน) */
const guessRoomAny = (r = {}) => {
  // คีย์ตรงๆ ก่อน
  const direct = [
    r.room, r.room_no, r.roomNo, r.room_code, r.roomCode, r.roomName,
    r.roomname, r.room_label, r.label
  ];
  for (const v of direct) if (v != null && v !== "") return String(v).trim();

  // ไล่ดูทุกคีย์ที่มีคำว่า room
  for (const [k, v] of Object.entries(r)) {
    if (!/(room|ห้อง)/i.test(k) || v == null) continue;
    if (typeof v === "string" || typeof v === "number") return String(v).trim();
    if (typeof v === "object") {
      const vv = v.room_id ?? v.room_number ?? v.id ?? v.code ?? v.number ?? v.name ?? v.no;
      if (vv != null && vv !== "") return String(vv).trim();
    }
  }
  return "";
};

const roomLabel = (r = {}) => {
  const id = getRoomId(r);
  const no = getRoomNo(r);
  if (id && no) return `${id} (${no})`;
  const any = guessRoomAny(r);
  return (id || no || any || "-");
};

// comparator เรียงตามหมายเลขห้อง (อิง label ที่หาได้จริง)
function roomComparator(a, b) {
  const A = roomLabel(a);
  const B = roomLabel(b);
  return A.localeCompare(B, undefined, { numeric: true, sensitivity: "base" });
}

/* ================== Status mapping ================== */
// “ค้างชำระ” ไม่ให้แสดงในหน้านี้ → map เป็น “พักอยู่”
const normalizeStatusKey = (s) => {
  const k = String(s || "").toLowerCase();
  if (k === "overdue") return "occupied";
  return k;
};
const statusMap = {
  vacant:   { text: "ว่าง",     badge: "badge-vacant" },
  occupied: { text: "พักอยู่",   badge: "badge-occupied" },
  pending:  { text: "รอเข้าพัก", badge: "badge-pending" },
};
const statusDisplay = (statusText) => {
  const key = normalizeStatusKey(statusText);
  const m = statusMap[key];
  return m ? <span className={`badge ${m.badge}`}>{m.text}</span>
           : <span className="badge">{statusText || "-"}</span>;
};

export default function RoomsStatusTable({ data = [] }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const base = [...data].sort(roomComparator);
    const term = q.trim().toLowerCase();
    if (!term) return base;

    return base.filter((r) => {
      const room   = roomLabel(r).toLowerCase();
      const tenant = String(r.tenant_name ?? r.tenant ?? "-").toLowerCase();
      const sKey   = normalizeStatusKey(r.status ?? r.room_status ?? "");
      const sTh    = (sKey === "vacant" ? "ว่าง" : sKey === "occupied" ? "พักอยู่" :
                     sKey === "pending" ? "รอเข้าพัก" : "").toLowerCase();

      // รองรับค้นหาด้วยคำไทย “ว่าง/พักอยู่”
      const isThai = (term === "ว่าง" && sKey === "vacant") ||
                     (term === "พักอยู่" && sKey === "occupied");
      return room.includes(term) || tenant.includes(term) || sTh.includes(term) || isThai;
    });
  }, [data, q]);

  // KPI (ห้องเท่านั้น ไม่คิด overdue เป็นสถานะ)
  const kpi = useMemo(() => {
    const total    = data.length;
    const vacant   = data.filter(r => normalizeStatusKey(r.status || r.room_status) === "vacant").length;
    const occupied = data.filter(r => normalizeStatusKey(r.status || r.room_status) === "occupied").length;
    return { total, vacant, occupied };
  }, [data]);

  return (
    <div>
      {/* KPI แนวนอน */}
      <div className="kpi-grid" style={{ marginBottom: 12 }}>
        <div className="kpi">
          <div className="kpi-title">ห้องทั้งหมด</div>
          <div className="kpi-value">{kpi.total}</div>
        </div>
        <div className="kpi">
          <div className="kpi-title">ว่าง</div>
          <div className="kpi-value">{kpi.vacant}</div>
        </div>
        <div className="kpi">
          <div className="kpi-title">พักอยู่</div>
          <div className="kpi-value">{kpi.occupied}</div>
        </div>
      </div>

      {/* ค้นหา */}
      <div className="control-row" style={{ marginBottom: 10 }}>
        <input
          className="input"
          style={{ maxWidth: 320 }}
          placeholder="ค้นหา (A101, 101, ชื่อผู้เช่า, ว่าง/พักอยู่)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="muted">ทั้งหมด {data.length} ห้อง • แสดง {filtered.length} ห้อง</div>
      </div>

      {/* ตาราง */}
      <div className="table-wrap">
        <table className="table">
          <thead className="thead">
            <tr>
              <th className="th">ห้อง</th>
              <th className="th">สถานะห้อง</th>
              <th className="th">ผู้เช่า</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length ? filtered.map((r, i) => (
              <tr key={i} className="tr">
                <td className="td td-room">{roomLabel(r)}</td>
                <td className="td">{statusDisplay(r.status || r.room_status)}</td>
                <td className="td">{r.tenant_name || r.tenant || "-"}</td>
              </tr>
            )) : (
              <tr><td className="empty" colSpan={3}>ไม่พบข้อมูล</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
