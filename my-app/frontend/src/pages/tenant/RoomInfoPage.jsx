import React, { useEffect, useState } from "react";
import { roomApi } from "../../services/room.api";

export default function RoomInfoPage() {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      setErr("");
      // ใช้ getMine ให้ตรงกับ room.api.js
      const res = await roomApi.getMine();
      setRooms(Array.isArray(res) ? res : []);
    } catch (e) {
      const api = e?.response?.data;
      setErr(api?.error || api?.message || "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <>
      <h1 className="tn-title">ข้อมูลห้องพัก</h1>
      <p className="muted">แสดงเฉพาะห้องของบัญชีผู้ใช้ปัจจุบัน</p>

      <div style={{ margin: "12px 0" }}>
        <button onClick={load} className="btn-primary" style={{ width: "auto", padding: "10px 14px" }}>
          รีเฟรช
        </button>
      </div>

      {loading && <div className="card"><p className="muted">กำลังโหลดข้อมูล…</p></div>}
      {!loading && err && <div className="card"><p style={{ color: "#b91c1c" }}>{err}</p></div>}
      {!loading && !err && rooms.length === 0 && (
        <div className="card"><p className="muted">ยังไม่มีห้องที่ผูกกับบัญชีนี้</p></div>
      )}

      {!loading && !err && rooms.length > 0 && (
        <div className="room-grid">
          {rooms.map((r) => (
            <article key={r.room_id} className="room-card">
              <header className="room-head">
                <div className="room-badge">ห้อง {r.room_number}</div>
                <div className={`room-status ${r.status === "occupied" ? "ok" : "idle"}`}>
                  {r.status === "occupied" ? "มีผู้พักอาศัย" : "ว่าง"}
                </div>
              </header>

              <dl className="kv">
                <div className="kv-row">
                  <dt>รหัสห้อง</dt><dd>{r.room_id}</dd>
                </div>
                <div className="kv-row">
                  <dt>สิ่งอำนวยความสะดวก</dt>
                  <dd>
                    {r.has_fan && "พัดลม "}
                    {r.has_aircon && "แอร์ "}
                    {r.has_fridge && "ตู้เย็น "}
                    {(!r.has_fan && !r.has_aircon && !r.has_fridge) ? "-" : ""}
                  </dd>
                </div>
                <div className="kv-row">
                  <dt>ราคา/เดือน</dt><dd>{Number(r.price).toLocaleString()} บาท</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
