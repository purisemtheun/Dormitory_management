// src/components/reports/RevenueDailyChart.jsx
import React, { useMemo } from "react";
import { CalendarRange, BarChart3, Receipt, ChevronDown } from "lucide-react";

/* ---------- normalizer: รองรับ array ได้หลายรูปแบบ ---------- */
const arr = (d) =>
  Array.isArray(d) ? d :
  Array.isArray(d?.rows) ? d.rows :
  Array.isArray(d?.data) ? d.data :
  Array.isArray(d?.items) ? d.items :
  Array.isArray(d?.result) ? d.result : [];

/* ---------- helpers ---------- */
function normalizeDate(v) {
  if (!v) return "";
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s.slice(0, 10);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
}
const num = (v) => Number(v || 0) || 0;
const thb = (n) =>
  num(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ---------- small UI parts ---------- */
function KPICard({ title, value, icon, tone = "slate" }) {
  const map = {
    slate:   { text: "text-slate-700",   ring: "border-slate-400",   bg: "bg-slate-50" },
    indigo:  { text: "text-indigo-700",  ring: "border-indigo-400",  bg: "bg-indigo-50" },
    sky:     { text: "text-sky-700",     ring: "border-sky-400",     bg: "bg-sky-50" },
    emerald: { text: "text-emerald-700", ring: "border-emerald-400", bg: "bg-emerald-50" },
    amber:   { text: "text-amber-700",   ring: "border-amber-400",   bg: "bg-amber-50" },
    violet:  { text: "text-violet-700",  ring: "border-violet-400",  bg: "bg-violet-50" },
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
          {React.cloneElement(icon, { className: `w-6 h-6 ${th.text}` })}
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

/* ---------- main component ---------- */
export default function RevenueDailyChart({
  data = [],
  range = { from: "", to: "" },
  setRange,
  onDateClick,
}) {
  // map/normalize rows
  const rows = useMemo(() => {
    const items = arr(data);
    return items
      .map((r) => {
        const dateRaw =
          r.period || r.date || r.report_date || r.paid_at || r.payment_date || "";
        const amt = num(r.revenue ?? r.total ?? 0);
        const paid = num(r.paid ?? r.count ?? r.payments_count ?? 0);
        return { _date: normalizeDate(dateRaw), amount: amt, paid };
      })
      .filter((x) => x._date)
      .sort((a, b) => a._date.localeCompare(b._date));
  }, [data]);

  // KPIs
  const kpi = useMemo(() => {
    const total = rows.reduce((s, r) => s + r.amount, 0);
    const count = rows.length;
    const avg = count ? total / count : 0;
    const max = rows.reduce((m, r) => Math.max(m, r.amount), 0);
    const totalPaid = rows.reduce((s, r) => s + (r.paid || 0), 0);
    return { total, avg, max, days: count, totalPaid };
  }, [rows]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6">
        <div className="flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full border border-indigo-300 bg-indigo-50 flex items-center justify-center">
              <CalendarRange className="w-6 h-6 text-indigo-700" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">รายงานรายวัน</h2>
              <p className="text-slate-600 text-sm mt-0.5">
                สรุปรายรับตามวัน • รวมทั้งวัน • เฉลี่ยต่อวัน • จำนวนรายการชำระ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-lg px-3 py-2">
              <CalendarRange className="w-5 h-5 text-slate-500" />
              <span className="text-sm text-slate-700">ช่วงวันที่</span>

              <input
                type="date"
                value={range.from || ""}
                onChange={(e) => setRange?.((p) => ({ ...p, from: e.target.value }))}
                className="w-[10.5rem] pl-2 pr-2 py-1.5 border-0 focus:ring-0 focus:outline-none text-slate-900"
              />
              <span className="text-slate-400">ถึง</span>
              <input
                type="date"
                value={range.to || ""}
                onChange={(e) => setRange?.((p) => ({ ...p, to: e.target.value }))}
                className="w-[10.5rem] pl-2 pr-2 py-1.5 border-0 focus:ring-0 focus:outline-none text-slate-900"
              />
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </div>
          </div>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title={`รวม (${kpi.days} วัน)`} value={`฿ ${thb(kpi.total)}`} icon={<BarChart3 />} tone="emerald" />
        <KPICard title="เฉลี่ยต่อวัน" value={`฿ ${thb(kpi.avg)}`} icon={<BarChart3 />} tone="sky" />
        <KPICard title="สูงสุดต่อวัน" value={`฿ ${thb(kpi.max)}`} icon={<BarChart3 />} tone="violet" />
        <KPICard title="จำนวนการชำระ (ใบ)" value={kpi.totalPaid.toLocaleString()} icon={<Receipt />} tone="amber" />
      </div>

      {/* Banner */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 text-blue-900 px-4 py-3">
        ยอดรวมช่วง {range.from || "-"} ถึง {range.to || "-"}:&nbsp;
        <span className="font-bold">฿ {thb(kpi.total)}</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="sticky top-0 z-10 bg-indigo-900 text-white shadow-md">
                <Th className="text-left">วันที่</Th>
                <Th className="text-right">รายรับ (฿)</Th>
                <Th className="text-right">จำนวนรายการ (ใบ)</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-16 text-center text-lg text-slate-500 bg-slate-50/50">
                    ไม่มีข้อมูลรายรับในช่วงที่เลือก
                  </td>
                </tr>
              ) : (
                rows.map((r, i) => (
                  <tr
                    key={r._date || i}
                    className="hover:bg-indigo-50/30 transition-colors cursor-pointer"
                    onClick={() => onDateClick?.(r._date)}
                    title="คลิกเพื่อดูรายละเอียดวันนี้"
                  >
                    <td className="px-6 py-4 font-semibold text-slate-900">{r._date}</td>
                    <TdRight className="font-bold text-slate-900">{thb(r.amount)}</TdRight>
                    <TdRight>{(r.paid || 0).toLocaleString()}</TdRight>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
