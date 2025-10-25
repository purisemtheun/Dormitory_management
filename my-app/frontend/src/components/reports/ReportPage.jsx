// src/pages/reports/ReportsPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import RoomsStatusTable from "../../components/reports/RoomsStatusTable";

// ===== API base =====
const BASE = process.env.REACT_APP_API || "http://localhost:3000/api";

/* ========= Named API functions (ให้เพจอื่น import ใช้ได้) ========= */
export async function getRoomsStatus() {
  const r = await fetch(`${BASE}/reports/rooms-status`, { credentials: "include" });
  if (!r.ok) throw new Error("Failed to fetch rooms status");
  return r.json();
}
export async function getRevenueMonthly() {
  const r = await fetch(`${BASE}/reports/revenue-monthly`, { credentials: "include" });
  if (!r.ok) throw new Error("Failed to fetch revenue monthly");
  return r.json();
}
export async function getDebts() {
  const r = await fetch(`${BASE}/reports/debts`, { credentials: "include" });
  if (!r.ok) throw new Error("Failed to fetch debts");
  return r.json();
}

/* ========= Page Component ========= */
export default function ReportsPage() {
  const [tab, setTab] = useState("rooms"); // 'rooms' | 'revenue' | 'debts'
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [rooms, setRooms] = useState([]);
  const [revenue, setRevenue] = useState([]);
  const [debts, setDebts] = useState([]);

  // โหลดข้อมูลตามแท็บ
  useEffect(() => {
    let alive = true;
    async function load() {
      setErr("");
      setLoading(true);
      try {
        if (tab === "rooms") {
          const res = await getRoomsStatus();
          if (!alive) return;
          setRooms(Array.isArray(res?.data || res) ? (res.data || res) : []);
        } else if (tab === "revenue") {
          const res = await getRevenueMonthly();
          if (!alive) return;
          setRevenue(Array.isArray(res?.data || res) ? (res.data || res) : []);
        } else if (tab === "debts") {
          const res = await getDebts();
          if (!alive) return;
          setDebts(Array.isArray(res?.data || res) ? (res.data || res) : []);
        }
      } catch (e) {
        setErr(e.message || "โหลดข้อมูลล้มเหลว");
      } finally {
        setLoading(false);
      }
    }
    load();
    return () => { alive = false; };
  }, [tab]);

  // KPI จาก rooms
  const kpi = useMemo(() => {
    const total = rooms.length;
    const vacant = rooms.filter(r => (r.status || r.room_status) === "vacant" || r.status_th === "ว่าง").length;
    const occupied = rooms.filter(r => (r.status || r.room_status) === "occupied" || r.status_th === "พักอยู่").length;
    const overdue = rooms.filter(r => (r.status || r.room_status) === "overdue" || r.status_th === "ค้างชำระ").length;
    return { total, vacant, occupied, overdue };
  }, [rooms]);

  return (
    <div className="page-wrap">
      <h2 className="page-title">รายงานสรุป</h2>

      {/* Tabs */}
      <div className="tabs" role="tablist" aria-label="รายงาน">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "rooms"}
          className={`tab-btn ${tab === "rooms" ? "is-active" : ""}`}
          onClick={() => setTab("rooms")}
        >
          สถานะห้อง
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "revenue"}
          className={`tab-btn ${tab === "revenue" ? "is-active" : ""}`}
          onClick={() => setTab("revenue")}
        >
          รายได้รายเดือน
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "debts"}
          className={`tab-btn ${tab === "debts" ? "is-active" : ""}`}
          onClick={() => setTab("debts")}
        >
          ค้างชำระ
        </button>
      </div>

      {loading && <div className="loading-text">กำลังโหลด…</div>}
      {err && <div className="error-text">ผิดพลาด: {err}</div>}

      {/* Rooms tab */}
      {tab === "rooms" && !loading && (
        <>
          <div className="kpi-grid">
            <div className="kpi">
              <div className="kpi-title">ห้องทั้งหมด</div>
              <div className="kpi-value">{kpi.total}</div>
              <div className="kpi-sub">รวมทุกสถานะ</div>
            </div>
            <div className="kpi">
              <div className="kpi-title">ว่าง</div>
              <div className="kpi-value">{kpi.vacant}</div>
              <div className="kpi-sub">พร้อมปล่อยเช่า</div>
            </div>
            <div className="kpi">
              <div className="kpi-title">พักอยู่</div>
              <div className="kpi-value">{kpi.occupied}</div>
              <div className="kpi-sub">ผู้เช่าแอคทีฟ</div>
            </div>
            <div className="kpi">
              <div className="kpi-title">ค้างชำระ</div>
              <div className="kpi-value">{kpi.overdue}</div>
              <div className="kpi-sub">ต้องติดตาม</div>
            </div>
          </div>

          <div className="card">
            <h3 className="card-title">สถานะห้องพัก</h3>
            <RoomsStatusTable rows={rooms} />
          </div>
        </>
      )}

      {/* Revenue tab */}
      {tab === "revenue" && !loading && (
        <div className="card">
          <h3 className="card-title">รายได้รายเดือน</h3>
          <div className="table-wrap">
            <table className="table">
              <thead className="thead">
                <tr>
                  <th className="th">เดือน</th>
                  <th className="th text-right">รายได้ (บาท)</th>
                </tr>
              </thead>
              <tbody>
                {revenue?.length ? revenue.map((r, i) => (
                  <tr key={i} className="tr">
                    <td className="td">{r.month_label || r.month}</td>
                    <td className="td text-right num">{Number(r.total || r.amount || 0).toLocaleString()}</td>
                  </tr>
                )) : (
                  <tr><td className="empty" colSpan={2}>ยังไม่มีข้อมูล</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Debts tab */}
      {tab === "debts" && !loading && (
        <div className="card">
          <h3 className="card-title">รายการค้างชำระ</h3>
          <div className="table-wrap">
            <table className="table">
              <thead className="thead">
                <tr>
                  <th className="th">ห้อง</th>
                  <th className="th">ผู้เช่า</th>
                  <th className="th text-right">ยอดค้าง (บาท)</th>
                </tr>
              </thead>
              <tbody>
                {debts?.length ? debts.map((d, i) => (
                  <tr key={i} className="tr">
                    <td className="td">{d.room_no || d.room}</td>
                    <td className="td">{d.tenant_name || "-"}</td>
                    <td className="td text-right num">{Number(d.amount || d.debt || 0).toLocaleString()}</td>
                  </tr>
                )) : (
                  <tr><td className="empty" colSpan={3}>ไม่มีหนี้ค้างชำระ</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
