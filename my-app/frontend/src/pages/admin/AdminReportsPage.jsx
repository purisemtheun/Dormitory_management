// src/pages/admin/AdminReportsPage.jsx
import React, { useEffect, useState } from "react";
import { reportApi } from "../../api/reports.api";

// sections
import RoomsStatusTable from "../../components/reports/RoomsStatusTable";
import PaymentsTable from "../../components/reports/PaymentsTable";
import RevenueMonthlyChart from "../../components/reports/RevenueMonthlyChart";
import RevenueDailyChart from "../../components/reports/RevenueDailyChart";
import DebtsTable from "../../components/reports/DebtsTable";
import UtilitiesTable from "../../components/reports/UtilitiesTable";

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
  const [roomsStatus, setRoomsStatus] = useState([]);

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
            const rows = await reportApi.roomsStatus();
            if (alive) setRoomsStatus(rows);
            break;
          }
          case "revenue-monthly": {
            const rows = await reportApi.revenueMonthly(months);
            if (alive) setRevenueMonthly(rows);
            break;
          }
          case "revenue-daily": {
            const rows = await reportApi.revenueDaily(dateRange.from, dateRange.to);
            if (alive) setRevenueDaily(rows);
            break;
          }
          case "debts": {
            const rows = await reportApi.debts(asOf);
            if (alive) setDebts(rows);
            break;
          }
          case "payments": {
            const rows = await reportApi.payments(paymentRange.from, paymentRange.to);
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

  /** Tab button (ไม่มีแอนิเมชันเลื่อน, hover แค่เข้มขึ้น) */
  const TabBtn = ({ id, children }) => {
    const isActive = activeTab === id;
    return (
      <button
        type="button"
        onClick={() => setActiveTab(id)}
        aria-pressed={isActive}
        style={{
          padding: "10px 14px",
          borderRadius: 8,
          border: `1px solid ${isActive ? "#1d4ed8" : "#d1d5db"}`,
          background: isActive ? "#1d4ed8" : "#ffffff",
          color: isActive ? "#ffffff" : "#111827",
          fontWeight: 600,
          cursor: "pointer",
          transition: "none", // ไม่มี animation
        }}
        onMouseEnter={(e) => {
          if (!isActive) e.currentTarget.style.background = "#f3f4f6";
        }}
        onMouseLeave={(e) => {
          if (!isActive) e.currentTarget.style.background = "#ffffff";
        }}
      >
        {children}
      </button>
    );
  };

  return (
    <div style={{ padding: 20 }}>
      <h2 style={{ margin: "0 0 12px" }}>รายงานภาพรวม</h2>

      <section
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: 16,
          boxShadow: "0 6px 18px rgba(0,0,0,.04)",
          background: "#fff",
        }}
      >
        {/* Tabs */}
        <nav style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
          <TabBtn id="rooms">สถานะห้อง</TabBtn>
          <TabBtn id="revenue-monthly">รายรับรายเดือน</TabBtn>
          <TabBtn id="revenue-daily">รายรับรายวัน</TabBtn>
          <TabBtn id="debts">หนี้ค้างชำระ</TabBtn>
          <TabBtn id="payments">การชำระเงิน</TabBtn>
          <TabBtn id="utilities">ค่าน้ำ/ค่าไฟ</TabBtn>
        </nav>

        {/* Body */}
        {loading ? (
          <div style={{ padding: 18, textAlign: "center" }}>กำลังโหลด…</div>
        ) : err ? (
          <div
            style={{
              color: "#b91c1c",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              padding: 12,
              borderRadius: 8,
            }}
          >
            {err}
          </div>
        ) : (
          <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 12 }}>
            {activeTab === "rooms" && <RoomsStatusTable data={roomsStatus} />}

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
              <DebtsTable
                data={debts}
                asOf={asOf}
                setAsOf={setAsOf}
              />
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
      </section>
    </div>
  );
}
