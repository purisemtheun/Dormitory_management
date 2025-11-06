import React, { useMemo } from "react";
import { BarChart3, Coins, Droplet, Zap, CalendarRange, ChevronDown } from "lucide-react";

export default function RevenueMonthlyChart({ data = [], months = 6, setMonths, onMonthClick }) {
  const toNum = (v) => Number(v ?? 0) || 0;
  const thb = (n) =>
    toNum(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const ymLabel = (ym) => {
    const s = String(ym ?? "");
    const parts = s.split("-");
    if (parts.length < 2) return s || "-";
    const [y, m] = parts;
    const d = new Date(`${y}-${m}-01T00:00:00`);
    if (Number.isNaN(+d)) return s || "-";
    return d.toLocaleDateString("th-TH", { month: "long", year: "numeric" });
  };

  // ---- Helper: breakdown (ปลอดภัยต่อ field ขาด/ชนิดเพี้ยน)
  const toBreakdown = (row = {}) => {
    const billed = {
      rent:    toNum(row.rent_amount),
      water:   toNum(row.water_amount),
      electric:toNum(row.electric_amount),
      total:   toNum(row.total_amount ?? row.total ?? row.revenue),
      rooms:   toNum(row.rooms_count ?? row.rooms),
    };

    const hasCollectedKeys = ["rent_collected","water_collected","electric_collected"]
      .some((k) => Object.prototype.hasOwnProperty.call(row || {}, k));

    const collected = {
      rent:    toNum(row.rent_collected),
      water:   toNum(row.water_collected),
      electric:toNum(row.electric_collected),
      total:   Object.prototype.hasOwnProperty.call(row || {}, "total_collected")
                ? toNum(row.total_collected)
                : null,
    };

    const allCollectedZero = collected.rent === 0 && collected.water === 0 && collected.electric === 0;
    const shouldFallbackCategory = hasCollectedKeys && allCollectedZero && toNum(row.total_collected) > 0;

    return {
      rent:     shouldFallbackCategory ? billed.rent     : (hasCollectedKeys ? collected.rent     : billed.rent),
      water:    shouldFallbackCategory ? billed.water    : (hasCollectedKeys ? collected.water    : billed.water),
      electric: shouldFallbackCategory ? billed.electric : (hasCollectedKeys ? collected.electric : billed.electric),
      total:    collected.total != null ? collected.total : billed.total,
      rooms:    billed.rooms,
    };
  };

  // ===== KPI =====
  const kpi = useMemo(() => {
    const rows = Array.isArray(data) ? data : [];
    return rows.map(toBreakdown).reduce(
      (acc, r) => ({
        months: acc.months + 1,
        rent: acc.rent + r.rent,
        water: acc.water + r.water,
        electric: acc.electric + r.electric,
        total: acc.total + r.total,
      }),
      { months: 0, rent: 0, water: 0, electric: 0, total: 0 }
    );
  }, [data]);

  const rows = Array.isArray(data) ? data : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6">
        <div className="flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full border border-indigo-300 bg-indigo-50 flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-indigo-700" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">รายงานรายเดือน</h2>
              <p className="text-slate-600 text-sm mt-0.5">
                แสดง <b>ยอดที่เก็บแล้ว (approved)</b> เป็นหลัก • ถ้ายังไม่อนุมัติ/ยังไม่แจกแจงประเภท จะแสดงยอดวางบิลแทน
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-lg px-3 py-2">
              <CalendarRange className="w-5 h-5 text-slate-500" />
              <span className="text-sm text-slate-700">เดือนย้อนหลัง</span>
              <input
                type="number"
                min={1}
                max={24}
                value={Number.isFinite(months) ? months : 6}
                onChange={(e) => setMonths?.(Number(e.target.value) || 1)}
                className="w-20 pl-2 pr-7 py-1.5 text-right border-0 focus:ring-0 focus:outline-none text-slate-900"
              />
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </div>
          </div>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title={`ค่าเช่า (${kpi.months} เดือน)`} value={`฿ ${thb(kpi.rent)}`} icon={<Coins />} tone="indigo" />
        <KPICard title="ค่าน้ำ" value={`฿ ${thb(kpi.water)}`} icon={<Droplet />} tone="sky" />
        <KPICard title="ค่าไฟ" value={`฿ ${thb(kpi.electric)}`} icon={<Zap />} tone="amber" />
        <KPICard title="รวมทั้งหมด" value={`฿ ${thb(kpi.total)}`} icon={<BarChart3 />} tone="emerald" />
      </div>

      {/* Banner */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 text-blue-900 px-4 py-3">
        ยอด<strong>ที่เก็บแล้ว</strong> {kpi.months} เดือนล่าสุด: <span className="font-bold">฿ {thb(kpi.total)}</span>
        <span className="text-blue-900/70"> (ถ้าเดือนไหนยังไม่อนุมัติหรือไม่แจกแจงประเภท จะแสดงยอดวางบิลแทนเฉพาะค่าน้ำ/ไฟ/เช่า)</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="sticky top-0 z-10 bg-indigo-900 text-white shadow-md">
                <Th className="text-left">งวด (ปี–เดือน)</Th>
                <Th className="text-right">ค่าเช่า (฿)</Th>
                <Th className="text-right">ค่าน้ำ (฿)</Th>
                <Th className="text-right">ค่าไฟ (฿)</Th>
                <Th className="text-right">รวม (฿)</Th>
                <Th className="text-right">จำนวนห้อง</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-lg text-slate-500 bg-slate-50/50">
                    ไม่มีข้อมูลในช่วงที่เลือก
                  </td>
                </tr>
              ) : (
                rows.map((r, i) => {
                  const b = toBreakdown(r);
                  const period = r?.period_ym ?? r?.period ?? r?.month ?? "";
                  return (
                    <tr
                      key={`${period}-${i}`}
                      className="hover:bg-indigo-50/30 transition-colors cursor-pointer"
                      onClick={() => onMonthClick?.(period)}
                      title="คลิกเพื่อดูรายละเอียดเดือนนี้"
                    >
                      <td className="px-6 py-4 font-semibold text-slate-900">{ymLabel(period)}</td>
                      <TdRight>{thb(b.rent)}</TdRight>
                      <TdRight>{thb(b.water)}</TdRight>
                      <TdRight>{thb(b.electric)}</TdRight>
                      <TdRight className="font-bold text-slate-900">{thb(b.total)}</TdRight>
                      <TdRight>{b.rooms}</TdRight>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ========== Small UI parts ========== */
function KPICard({ title, value, icon, tone = "slate" }) {
  const map = {
    slate:   { text: "text-slate-700",   ring: "border-slate-400",   bg: "bg-slate-50" },
    indigo:  { text: "text-indigo-700",  ring: "border-indigo-400",  bg: "bg-indigo-50" },
    sky:     { text: "text-sky-700",     ring: "border-sky-400",     bg: "bg-sky-50" },
    amber:   { text: "text-amber-700",   ring: "border-amber-400",   bg: "bg-amber-50" },
    emerald: { text: "text-emerald-700", ring: "border-emerald-400", bg: "bg-emerald-50" },
  };
  const th = map[tone] || map.slate;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 relative overflow-hidden transition-all duration-300 hover:shadow-lg">
      <div className={`absolute top-0 left-0 bottom-0 w-1.5 ${th.ring.replace("border-","bg-")}`} />
      <div className="pl-2 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500 tracking-wide">{title}</p>
          <p className="mt-1 text-2xl font-extrabold text-slate-900">{value}</p>
        </div>
        <div className={`w-12 h-12 rounded-full ${th.bg} flex items-center justify-center`}>
          {React.isValidElement(icon) ? React.cloneElement(icon, { className: `w-6 h-6 ${th.text}` }) : null}
        </div>
      </div>
    </div>
  );
}
function Th({ children, className = "" }) {
  return <th className={`px-6 py-3.5 text-base font-semibold ${className}`}>{children}</th>;
}
function TdRight({ children, className = "" }) {
  return <td className={`px-6 py-4 text-right text-slate-800 ${className}`}>{children}</td>;
}
