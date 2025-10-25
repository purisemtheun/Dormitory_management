import React, { useState, useEffect } from "react";
import { reportApi } from "../../api/reports.api";
import RoomsStatusTable from "../../components/reports/RoomsStatusTable";
import PaymentsTable from "../../components/reports/PaymentsTable";
import RevenueMonthlyChart from "../../components/reports/RevenueMonthlyChart";
import RevenueDailyChart from "../../components/reports/RevenueDailyChart";
import DebtsTable from "../../components/reports/DebtsTable";
import UtilitiesTable from "../../components/reports/UtilitiesTable";

const getToday = () => new Date().toISOString().slice(0, 10);
const getCurrentPeriod = () => new Date().toISOString().slice(0, 7);

export default function AdminReportsPage() {
  const [activeTab, setActiveTab] = useState("rooms");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [roomsStatus, setRoomsStatus] = useState([]);

  const [revenueMonthly, setRevenueMonthly] = useState([]);
  const [months, setMonths] = useState(6);

  const [revenueDaily, setRevenueDaily] = useState([]);
  const [dateRange, setDateRange] = useState({ from: getToday(), to: getToday() });

  const [debts, setDebts] = useState([]);
  const [asOf, setAsOf] = useState(getToday());

  const [payments, setPayments] = useState([]);
  const [paymentRange, setPaymentRange] = useState({ from: getToday(), to: getToday() });

  const [utilities, setUtilities] = useState([]);          // ← รับข้อมูลจาก meterMonthly
  const [utilityPeriod, setUtilityPeriod] = useState(getCurrentPeriod()); // YYYY-MM

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr("");

        if (activeTab === "rooms") {
          const data = await reportApi.roomsStatus();
          if (alive) setRoomsStatus(data);
        } else if (activeTab === "revenue-monthly") {
          const data = await reportApi.revenueMonthly(months);
          if (alive) setRevenueMonthly(data);
        } else if (activeTab === "revenue-daily") {
          const data = await reportApi.revenueDaily(dateRange.from, dateRange.to);
          if (alive) setRevenueDaily(data);
        } else if (activeTab === "debts") {
          const data = await reportApi.debts(asOf);
          if (alive) setDebts(data);
        } else if (activeTab === "payments") {
          // ✅ แม้ backend ไม่มี route ก็จะได้ []
          const data = await reportApi.payments(paymentRange.from, paymentRange.to);
          if (alive) setPayments(data);
        } else if (activeTab === "utilities") {
          // ✅ ใช้ meterMonthly แทน utilities
          const data = await reportApi.meterMonthly(utilityPeriod);
          if (alive) setUtilities(data);
        }
      } catch (e) {
        if (alive) setErr(e.message || "โหลดข้อมูลล้มเหลว");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [activeTab, months, dateRange, asOf, paymentRange, utilityPeriod]);

  // ปุ่มแท็บแบบ “ไร้อนิเมชัน”
  const TabBtn = ({ id, children }) => {
    const active = activeTab === id;
    return (
      <button
        onClick={() => setActiveTab(id)}
        style={{
          padding: "10px 14px",
          borderRadius: 6,
          border: `1px solid ${active ? "#1d4ed8" : "#d1d5db"}`,
          background: active ? "#1d4ed8" : "#fff",
          color: active ? "#fff" : "#111827",
          fontWeight: 600,
          cursor: "pointer",
        }}
        onMouseEnter={(e) => {
          if (!active) e.currentTarget.style.background = "#f3f4f6";
        }}
        onMouseLeave={(e) => {
          if (!active) e.currentTarget.style.background = "#fff";
        }}
      >
        {children}
      </button>
    );
  };

  return (
    <div style={{ padding: 20 }}>
      <h2 style={{ margin: "0 0 12px" }}>รายงานภาพรวม</h2>

      <div style={{
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 16,
        boxShadow: "0 6px 18px rgba(0,0,0,.04)"
      }}>
        {/* แถวปุ่มเมนู — ไม่มีอนิเมชัน */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
          <TabBtn id="rooms">สถานะห้อง</TabBtn>
          <TabBtn id="revenue-monthly">รายรับรายเดือน</TabBtn>
          <TabBtn id="revenue-daily">รายรับรายวัน</TabBtn>
          <TabBtn id="debts">หนี้ค้างชำระ</TabBtn>
          <TabBtn id="payments">การชำระเงิน</TabBtn>
          <TabBtn id="utilities">ค่าน้ำ/ค่าไฟ</TabBtn>
        </div>

        {loading ? (
          <div style={{ padding: 18, textAlign: "center" }}>กำลังโหลด…</div>
        ) : err ? (
          <div style={{ color:"#b91c1c", background:"#fef2f2", border:"1px solid #fecaca", padding:12, borderRadius:8 }}>
            {err}
          </div>
        ) : (
          <div style={{ borderTop:"1px solid #e5e7eb", paddingTop:12 }}>
            {activeTab === "rooms" && <RoomsStatusTable data={roomsStatus} />}

            {activeTab === "revenue-monthly" && (
              <RevenueMonthlyChart data={revenueMonthly} months={months} setMonths={setMonths} />
            )}

            {activeTab === "revenue-daily" && (
              <RevenueDailyChart data={revenueDaily} range={dateRange} setRange={setDateRange} />
            )}

            {activeTab === "debts" && (
              <DebtsTable data={debts} asOf={asOf} setAsOf={setAsOf} />
            )}

            {activeTab === "payments" && (
              <PaymentsTable data={payments} range={paymentRange} setRange={setPaymentRange} />
            )}

            {activeTab === "utilities" && (
              <UtilitiesTable data={utilities} period={utilityPeriod} setPeriod={setUtilityPeriod} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
