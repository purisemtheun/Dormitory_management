// frontend/src/pages/reports/ReportsPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import RoomsStatusReport from "../../components/reports/RoomsStatusReport";
import RevenueMonthlyChart from "../../components/reports/RevenueMonthlyChart";
import RevenueDailyChart from "../../components/reports/RevenueDailyChart";
import DebtsTable from "../../components/reports/DebtsTable";
import PaymentsTable from "../../components/reports/PaymentsTable";
import UtilitiesTable from "../../components/reports/UtilitiesTable";
import { reportApi } from "../../api/reports.api";

// NOTE: ปุ่ม/แท็บหลัก: rooms | revenue | debts | payments | utilities
export default function ReportsPage() {
  const [tab, setTab] = useState("rooms");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // state per tab
  const [rooms, setRooms] = useState([]);
  const [revenueMonthly, setRevenueMonthly] = useState([]);
  const [revenueDaily, setRevenueDaily] = useState([]);
  const [debts, setDebts] = useState([]);
  const [payments, setPayments] = useState([]);
  const [utilsData, setUtilsData] = useState([]);

  // filters
  const [months, setMonths] = useState(6);
  const [range, setRange] = useState({ from: "", to: "" });
  const [asOf, setAsOf] = useState("");
  const [period, setPeriod] = useState("");

  // โหลดข้อมูลตามแท็บ
  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setErr("");
        setLoading(true);

        if (tab === "rooms") {
          const res = await reportApi.roomsStatus();
          if (!alive) return;
          setRooms(Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : []);
        }

        if (tab === "revenue") {
          // monthly
          const monthly = await reportApi.revenueMonthly(months);
          if (!alive) return;
          setRevenueMonthly(
            Array.isArray(monthly) ? monthly : Array.isArray(monthly?.data) ? monthly.data : []
          );

          // daily (ช่วงวันที่ ถ้าผู้ใช้เลือก)
          if (range.from && range.to) {
            const daily = await reportApi.revenueDaily(range.from, range.to);
            setRevenueDaily(
              Array.isArray(daily) ? daily : Array.isArray(daily?.data) ? daily.data : []
            );
          } else {
            setRevenueDaily([]);
          }
        }

        if (tab === "debts") {
          const res = await reportApi.debts(asOf);
          if (!alive) return;
          setDebts(Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : []);
        }

        if (tab === "payments") {
          if (range.from && range.to) {
            const res = await reportApi.payments(range.from, range.to);
            if (!alive) return;
            setPayments(Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : []);
          } else {
            setPayments([]);
          }
        }

        if (tab === "utilities") {
          if (period) {
            const res = await reportApi.meterMonthly(period);
            if (!alive) return;
            const d =
              Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
            setUtilsData(d);
          } else {
            setUtilsData([]);
          }
        }
      } catch (e) {
        setErr(e?.message || "โหลดข้อมูลล้มเหลว");
      } finally {
        setLoading(false);
      }
    }

    load();
    return () => { alive = false; };
  }, [tab, months, range?.from, range?.to, asOf, period]);

  // KPI rooms (ป้องกัน key ต่างภาษา)
  const kpiRooms = useMemo(() => {
    const list = Array.isArray(rooms) ? rooms : [];
    const total = list.length;
    const status = (r) => String(r.status || r.room_status || r.status_th || "").toLowerCase();
    const vacant   = list.filter((r) => /(vacant|ว่าง)/.test(status(r))).length;
    const occupied = list.filter((r) => /(occupied|พักอยู่)/.test(status(r))).length;
    const pending  = list.filter((r) => /(pending|รอเข้าพัก)/.test(status(r))).length;
    return { total, vacant, occupied, pending };
  }, [rooms]);

  return (
    <div className="page-wrap">
      <h2 className="page-title">รายงานสรุป</h2>

      {/* Tabs */}
      <div className="tabs" role="tablist" aria-label="รายงาน">
        {[
          ["rooms","สถานะห้อง"],
          ["revenue","รายได้"],
          ["debts","ค้างชำระ"],
          ["payments","การชำระเงิน"],
          ["utilities","ค่าน้ำ/ไฟ"],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={`tab-btn ${tab === key ? "is-active" : ""}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && <div className="loading-text">กำลังโหลด…</div>}
      {err && <div className="error-text">ผิดพลาด: {err}</div>}

      {/* ROOMS */}
      {tab === "rooms" && !loading && (
        <>
          <div className="kpi-grid">
            <div className="kpi"><div className="kpi-title">ห้องทั้งหมด</div><div className="kpi-value">{kpiRooms.total}</div></div>
            <div className="kpi"><div className="kpi-title">ว่าง</div><div className="kpi-value">{kpiRooms.vacant}</div></div>
            <div className="kpi"><div className="kpi-title">พักอยู่</div><div className="kpi-value">{kpiRooms.occupied}</div></div>
            <div className="kpi"><div className="kpi-title">รอเข้าพัก</div><div className="kpi-value">{kpiRooms.pending}</div></div>
          </div>

          <div className="card">
            <h3 className="card-title">สถานะห้องพัก</h3>
            <RoomsStatusReport data={Array.isArray(rooms) ? rooms : []} />
          </div>
        </>
      )}

      {/* REVENUE */}
      {tab === "revenue" && !loading && (
        <>
          <div className="card">
            <h3 className="card-title">รายได้รายเดือน</h3>
            <RevenueMonthlyChart
              data={Array.isArray(revenueMonthly) ? revenueMonthly : []}
              months={months}
              setMonths={setMonths}
              onMonthClick={() => {}}
            />
          </div>

          <div className="card mt-6">
            <h3 className="card-title">รายได้รายวัน</h3>
            <RevenueDailyChart
              data={Array.isArray(revenueDaily) ? revenueDaily : []}
              range={range}
              setRange={setRange}
              onDateClick={() => {}}
            />
          </div>
        </>
      )}

      {/* DEBTS */}
      {tab === "debts" && !loading && (
        <div className="card">
          <h3 className="card-title">รายการค้างชำระ</h3>
          <DebtsTable data={Array.isArray(debts) ? debts : []} asOf={asOf} setAsOf={setAsOf} />
        </div>
      )}

      {/* PAYMENTS */}
      {tab === "payments" && !loading && (
        <div className="card">
          <h3 className="card-title">การชำระเงิน</h3>
          <PaymentsTable data={Array.isArray(payments) ? payments : []} range={range} setRange={setRange} />
        </div>
      )}

      {/* UTILITIES */}
      {tab === "utilities" && !loading && (
        <div className="card">
          <h3 className="card-title">รายงานค่าน้ำ/ค่าไฟ</h3>
          <div className="mb-3">
            <label className="text-sm text-slate-700">เลือกงวด (YYYY-MM)</label>{" "}
            <input
              type="month"
              value={period || ""}
              onChange={(e) => setPeriod(e.target.value)}
              className="border px-2 py-1 rounded"
            />
          </div>
          <UtilitiesTable data={utilsData} period={period} setPeriod={setPeriod} />
        </div>
      )}
    </div>
  );
}
