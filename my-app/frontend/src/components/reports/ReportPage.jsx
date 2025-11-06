// frontend/src/pages/reports/ReportsPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Home, PieChart, CalendarCheck, Wallet, Droplet, Zap, BarChart2,
} from "lucide-react";

import RoomsStatusReport from "../../components/reports/RoomsStatusReport";
import RevenueMonthlyChart from "../../components/reports/RevenueMonthlyChart";
import RevenueDailyChart from "../../components/reports/RevenueDailyChart";
import DebtsTable from "../../components/reports/DebtsTable";
import PaymentsTable from "../../components/reports/PaymentsTable";
import UtilitiesTable from "../../components/reports/UtilitiesTable";

// ใช้ default export ถ้าคุณตั้งไว้แบบ export default ใน api
import reportApi from "../../api/reports.api";

/* ---------- helpers: default dates ---------- */
const todayStr = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n = 7) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};
const currentYm = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
};

export default function ReportsPage() {
  const [tab, setTab] = useState("rooms"); // rooms | revenue | debts | payments | utilities
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // state
  const [rooms, setRooms] = useState([]);
  const [revenueMonthly, setRevenueMonthly] = useState([]);
  const [revenueDaily, setRevenueDaily] = useState([]);
  const [debts, setDebts] = useState([]);
  const [payments, setPayments] = useState([]);
  const [utilsData, setUtilsData] = useState([]);

  // filters
  const [months, setMonths] = useState(6);
  const [range, setRange] = useState({ from: daysAgo(7), to: todayStr() });
  const [asOf, setAsOf] = useState(todayStr());
  const [period, setPeriod] = useState(currentYm());

  // load by tab
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setErr("");
        setLoading(true);

        if (tab === "rooms") {
          const res = await reportApi.roomsStatus();
          if (!alive) return;
          setRooms(Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : []);
        }

        if (tab === "revenue") {
          const monthly = await reportApi.revenueMonthly(months);
          if (!alive) return;
          setRevenueMonthly(Array.isArray(monthly) ? monthly : Array.isArray(monthly?.data) ? monthly.data : []);
          const daily = await reportApi.revenueDaily(range.from, range.to);
          if (!alive) return;
          setRevenueDaily(Array.isArray(daily) ? daily : Array.isArray(daily?.data) ? daily.data : []);
        }

        if (tab === "debts") {
          const res = await reportApi.debts(asOf);
          if (!alive) return;
          setDebts(Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : []);
        }

        if (tab === "payments") {
          const res = await reportApi.payments(range.from, range.to);
          if (!alive) return;
          setPayments(Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : []);
        }

        if (tab === "utilities") {
          const res = await reportApi.meterMonthly(period);
          if (!alive) return;
          setUtilsData(Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : []);
        }
      } catch (e) {
        setErr(e?.message || "โหลดข้อมูลล้มเหลว");
      } finally {
        setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [tab, months, range.from, range.to, asOf, period]);

  // KPI rooms
  const kpiRooms = useMemo(() => {
    const list = Array.isArray(rooms) ? rooms : [];
    const total = list.length;
    const status = (r) => String(r.status || r.room_status || r.status_th || "").toLowerCase();
    const vacant   = list.filter((r) => /(vacant|ว่าง)/.test(status(r))).length;
    const occupied = list.filter((r) => /(occupied|พักอยู่|overdue)/.test(status(r))).length;
    const pending  = list.filter((r) => /(pending|รอเข้าพัก)/.test(status(r))).length;
    return { total, vacant, occupied, pending };
  }, [rooms]);

  const TabBtn = ({ id, label, icon: Icon }) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === id}
      onClick={() => setTab(id)}
      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium border transition
        ${tab === id
          ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"}`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );

  return (
    <div className="mx-auto w-full max-w-[1480px] px-2 sm:px-4 lg:px-6 py-6 space-y-6">
      {/* Page header */}
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-indigo-50 border border-indigo-200">
              <BarChart2 className="w-6 h-6 text-indigo-600" />
            </span>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">รายงานภาพรวม</h1>
              <p className="text-slate-600 text-sm mt-0.5">
                สถานะห้อง • รายรับ • หนี้ค้าง • การชำระเงิน • ค่าน้ำ/ไฟ
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="รายงาน">
            <TabBtn id="rooms"     label="สถานะห้อง"  icon={Home} />
            <TabBtn id="revenue"   label="รายรับรายเดือน/วัน" icon={PieChart} />
            <TabBtn id="debts"     label="ค้างชำระ"    icon={CalendarCheck} />
            <TabBtn id="payments"  label="การชำระเงิน" icon={Wallet} />
            <TabBtn id="utilities" label="ค่าน้ำ/ไฟ"   icon={Droplet} />
          </div>
        </div>
      </div>

      {/* Alerts */}
      {err && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-900 px-4 py-3">
          ผิดพลาด: {err}
        </div>
      )}
      {loading && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-900 px-4 py-3">
          กำลังโหลด…
        </div>
      )}

      {/* ROOMS */}
      {tab === "rooms" && !loading && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "ห้องทั้งหมด", value: kpiRooms.total },
              { label: "ว่าง", value: kpiRooms.vacant },
              { label: "พักอยู่", value: kpiRooms.occupied },
              { label: "รอเข้าพัก", value: kpiRooms.pending },
            ].map((k, i) => (
              <div key={i} className="bg-white rounded-2xl shadow border border-slate-200 p-5">
                <div className="text-slate-600 text-sm">{k.label}</div>
                <div className="text-3xl font-bold text-slate-900 mt-2">{k.value}</div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">สถานะห้องพัก</h3>
            <RoomsStatusReport data={Array.isArray(rooms) ? rooms : []} />
          </div>
        </>
      )}

      {/* REVENUE */}
      {tab === "revenue" && !loading && (
        <>
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <PieChart className="w-5 h-5 text-indigo-600" />
              <h3 className="text-lg font-semibold text-slate-900">รายได้รายเดือน</h3>
            </div>
            <RevenueMonthlyChart
              data={Array.isArray(revenueMonthly) ? revenueMonthly : []}
              months={months}
              setMonths={setMonths}
              onMonthClick={() => {}}
            />
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <BarChart2 className="w-5 h-5 text-indigo-600" />
              <h3 className="text-lg font-semibold text-slate-900">รายได้รายวัน</h3>
            </div>

            {/* ช่วงวันที่ */}
            <div className="flex flex-wrap gap-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-700">จาก</span>
                <input
                  type="date"
                  value={range.from}
                  onChange={(e) => setRange((p) => ({ ...p, from: e.target.value }))}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-indigo-100"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-700">ถึง</span>
                <input
                  type="date"
                  value={range.to}
                  onChange={(e) => setRange((p) => ({ ...p, to: e.target.value }))}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-indigo-100"
                />
              </div>
            </div>

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
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <CalendarCheck className="w-5 h-5 text-indigo-600" />
            <h3 className="text-lg font-semibold text-slate-900">รายการค้างชำระ (แยกหมวด)</h3>
          </div>

          <div className="mb-4">
            <span className="text-sm text-slate-700 mr-2">ณ วันที่</span>
            <input
              type="date"
              value={asOf}
              onChange={(e) => setAsOf(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-indigo-100"
            />
          </div>

          <DebtsTable data={Array.isArray(debts) ? debts : []} asOf={asOf} setAsOf={setAsOf} />
        </div>
      )}

      {/* PAYMENTS */}
      {tab === "payments" && !loading && (
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Wallet className="w-5 h-5 text-indigo-600" />
            <h3 className="text-lg font-semibold text-slate-900">การชำระเงิน</h3>
          </div>

          <div className="flex flex-wrap gap-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-700">จาก</span>
              <input
                type="date"
                value={range.from}
                onChange={(e) => setRange((p) => ({ ...p, from: e.target.value }))}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-indigo-100"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-700">ถึง</span>
              <input
                type="date"
                value={range.to}
                onChange={(e) => setRange((p) => ({ ...p, to: e.target.value }))}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-indigo-100"
              />
            </div>
          </div>

          <PaymentsTable data={Array.isArray(payments) ? payments : []} range={range} setRange={setRange} />
        </div>
      )}

      {/* UTILITIES */}
      {tab === "utilities" && !loading && (
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-indigo-50 border border-indigo-200">
              <div className="flex items-center gap-1.5">
                <Droplet className="w-4 h-4 text-sky-600" />
                <Zap className="w-4 h-4 text-amber-500" />
              </div>
            </span>
            <h3 className="text-lg font-semibold text-slate-900">รายงานค่าน้ำ/ค่าไฟ</h3>
          </div>

          <div className="mb-3 flex items-center gap-3">
            <label className="text-sm text-slate-700">เลือกงวด (YYYY-MM)</label>
            <input
              type="month"
              value={period || ""}
              onChange={(e) => setPeriod(e.target.value || currentYm())}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-indigo-100"
            />
          </div>

          <UtilitiesTable data={utilsData} period={period} setPeriod={setPeriod} />
        </div>
      )}
    </div>
  );
}
