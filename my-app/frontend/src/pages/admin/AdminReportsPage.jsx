// src/pages/admin/AdminReportsPage.jsx
import React, { useEffect, useState } from "react";
import { reportApi } from "../../api/reports.api";
import http from "../../services/http";

// sections
import RoomsStatusTable from "../../components/reports/RoomsStatusTable";
import PaymentsTable from "../../components/reports/PaymentsTable";
import RevenueMonthlyChart from "../../components/reports/RevenueMonthlyChart";
import RevenueDailyChart from "../../components/reports/RevenueDailyChart";
import DebtsTable from "../../components/reports/DebtsTable";
import UtilitiesTable from "../../components/reports/UtilitiesTable";

// icons
import {
  ClipboardList,
  Home,
  BarChart3,
  CalendarDays,
  CreditCard,
  AlertCircle,
  Droplets,
} from "lucide-react";

// helpers
const todayStr = () => new Date().toISOString().slice(0, 10);
const ymStr = () => new Date().toISOString().slice(0, 7);

export default function AdminReportsPage() {
  /** Tabs */
  const [activeTab, setActiveTab] = useState("rooms");

  /** Loading/Error */
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  /** Data states */
  const [roomsStatus, setRoomsStatus] = useState([]); // <— ใช้ตัวนี้แทน rows

  // counters ที่รับมาจาก /reports/rooms-status
  const [counters, setCounters] = useState({
    total: 0,
    vacant: 0,
    occupied: 0,
    reserved: 0,
    pending: 0,
  });

  const [revenueMonthly, setRevenueMonthly] = useState([]);
  const [months, setMonths] = useState(6);

  const [revenueDaily, setRevenueDaily] = useState([]);
  const [dateRange, setDateRange] = useState({ from: todayStr(), to: todayStr() });

  const [debts, setDebts] = useState([]);
  const [asOf, setAsOf] = useState(todayStr());

  const [payments, setPayments] = useState([]);
  const [paymentRange, setPaymentRange] = useState({ from: todayStr(), to: todayStr() });

  // น้ำ/ไฟ (รายเดือน)
  const [utilities, setUtilities] = useState([]);
  const [utilityPeriod, setUtilityPeriod] = useState(ymStr()); // YYYY-MM

  /** Load per tab */
  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        setLoading(true);
        setErr("");

        switch (activeTab) {
          case "rooms": {
            const res = await http.get("/reports/rooms-status", {
              headers: { "Cache-Control": "no-store" },
            });
            if (!alive) return;
            const data = res?.data ?? res ?? {};
            setCounters({
              total: Number(data.total || 0),
              vacant: Number(data.vacant || 0),
              occupied: Number(data.occupied || 0),
              reserved: Number(data.reserved || 0),
              pending: Number(data.pending || 0),
            });
            // <<< แก้จุดนี้
            setRoomsStatus(Array.isArray(data.rooms) ? data.rooms : []);
            break;
          }
          case "revenue-monthly": {
            const rows = await reportApi.revenueMonthly(months);
            if (alive) setRevenueMonthly(rows);
            break;
          }
          case "revenue-daily": {
            const rows = await reportApi.revenueDaily(
              dateRange.from,
              dateRange.to
            );
            if (alive) setRevenueDaily(rows);
            break;
          }
          case "debts": {
            const rows = await reportApi.debts(asOf);
            if (alive) setDebts(rows);
            break;
          }
          case "payments": {
            const rows = await reportApi.payments(
              paymentRange.from,
              paymentRange.to
            );
            if (alive) setPayments(rows);
            break;
          }
          case "utilities": {
            const rows = await reportApi.meterMonthly(utilityPeriod);
            if (alive) setUtilities(rows);
            break;
          }
          default:
            break;
        }
      } catch (e) {
        if (alive) setErr(e?.message || "โหลดข้อมูลล้มเหลว");
      } finally {
        if (alive) setLoading(false);
      }
    };

    load();
    return () => {
      alive = false;
    };
  }, [activeTab, months, dateRange, asOf, paymentRange, utilityPeriod]);

  /** Tab pill */
  const TabBtn = ({ id, icon, children }) => {
    const isActive = activeTab === id;
    return (
      <button
        type="button"
        role="tab"
        aria-selected={isActive}
        aria-controls={`panel-${id}`}
        onClick={() => setActiveTab(id)}
        data-active={isActive || undefined}
        className={[
          "inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition",
          "bg-white hover:shadow-md",
          "border-slate-300 text-slate-800",
          "focus:outline-none focus:ring-2 focus:ring-indigo-500",
          "data-[active=true]:bg-indigo-600 data-[active=true]:text-white data-[active=true]:border-indigo-600",
        ].join(" ")}
      >
        {icon}
        <span>{children}</span>
      </button>
    );
  };

  return (
    <div className="p-5 sm:p-6 lg:p-8 space-y-4">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6">
        <div className="flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full border border-indigo-300 bg-indigo-50 flex items-center justify-center">
              <ClipboardList className="w-6 h-6 text-indigo-700" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">รายงานภาพรวม</h2>
              <p className="text-slate-600 text-sm mt-0.5">
                สถานะห้อง • รายรับ • หนี้ค้าง • การชำระเงิน • ค่าน้ำ/ไฟ
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Card หลัก */}
      <section className="border border-slate-200 rounded-2xl bg-white shadow-sm">
        {/* Tabs */}
        <nav role="tablist" className="flex flex-wrap gap-2 p-4 border-b border-slate-200">
          <TabBtn id="rooms" icon={<Home className="w-4 h-4" />}>สถานะห้อง</TabBtn>
          <TabBtn id="revenue-monthly" icon={<BarChart3 className="w-4 h-4" />}>รายรับรายเดือน</TabBtn>
          <TabBtn id="revenue-daily" icon={<CalendarDays className="w-4 h-4" />}>รายรับรายวัน</TabBtn>
          <TabBtn id="debts" icon={<AlertCircle className="w-4 h-4" />}>หนี้ค้างชำระ</TabBtn>
          <TabBtn id="payments" icon={<CreditCard className="w-4 h-4" />}>การชำระเงิน</TabBtn>
          <TabBtn id="utilities" icon={<Droplets className="w-4 h-4" />}>ค่าน้ำ/ค่าไฟ</TabBtn>
        </nav>

        {/* Body */}
        <div className="p-4">
          {loading ? (
            <div className="py-8 text-center text-slate-600">กำลังโหลด…</div>
          ) : err ? (
            <div className="text-sm rounded-lg px-4 py-3 border border-red-200 text-red-800 bg-red-50">
              {err}
            </div>
          ) : (
            <div className="pt-3" id={`panel-${activeTab}`} role="tabpanel">
              {activeTab === "rooms" && (
                <RoomsStatusTable data={roomsStatus} counters={counters} />
              )}

              {activeTab === "revenue-monthly" && (
                <RevenueMonthlyChart
                  data={revenueMonthly}
                  months={months}
                  setMonths={setMonths}
                />
              )}

              {activeTab === "revenue-daily" && (
                <RevenueDailyChart
                  data={revenueDaily}
                  range={dateRange}
                  setRange={setDateRange}
                />
              )}

              {activeTab === "debts" && (
                <DebtsTable data={debts} asOf={asOf} setAsOf={setAsOf} />
              )}

              {activeTab === "payments" && (
                <PaymentsTable
                  data={payments}
                  range={paymentRange}
                  setRange={setPaymentRange}
                />
              )}

              {activeTab === "utilities" && (
                <UtilitiesTable
                  data={utilities}
                  period={utilityPeriod}
                  setPeriod={setUtilityPeriod}
                />
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
