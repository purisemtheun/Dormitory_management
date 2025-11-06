import React, { useEffect, useState } from "react";
import reportApi from "../../api/reports.api";
import { CalendarDays, BarChart3, RefreshCw } from "lucide-react";

export default function RevenueMonthlyPanel() {
  const [months, setMonths] = useState(6);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const resp = await reportApi.revenueMonthly(months);
      const data = Array.isArray(resp?.data) ? resp.data : Array.isArray(resp) ? resp : [];
      setRows(data);
    } catch (e) {
      console.error("revenueMonthly error", e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [months]);

  const total = rows.reduce((s, r) => s + Number(r.total_amount || r.revenue || 0), 0);

  return (
    <div className="space-y-6">
      <Header
        title="รายงานรายเดือน"
        subtitle="ยอดที่เก็บแล้ว (approved) เป็นหลัก"
        icon={BarChart3}
        onReload={load}
        loading={loading}
      />

      <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
        <span className="inline-flex items-center gap-2 text-sm text-slate-700">
          <CalendarDays className="w-4 h-4" />
          เดือนย้อนหลัง
        </span>
        <select
          className="border rounded-lg px-3 py-2"
          value={months}
          onChange={(e)=>setMonths(Number(e.target.value))}
        >
          {[3,6,9,12,18,24].map(m=><option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <p className="text-slate-600 text-sm">รวมทั้งสิ้น</p>
        <p className="text-3xl font-extrabold mt-1">฿ {total.toLocaleString()}</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-indigo-700">
              <Th>งวด (ปี-เดือน)</Th>
              <Th>ค่าเช่า (฿)</Th>
              <Th>ค่าน้ำ (฿)</Th>
              <Th>ค่าไฟ (฿)</Th>
              <Th>รวม (฿)</Th>
              <Th>จำนวนห้อง</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <SkeletonRows cols={6} rows={6} />
            ) : rows.length ? rows.map((r) => (
              <tr key={r.period_ym}>
                <Td>{r.period_ym}</Td>
                <Td>{fmt(r.rent_amount)}</Td>
                <Td>{fmt(r.water_amount)}</Td>
                <Td>{fmt(r.electric_amount)}</Td>
                <Td className="font-semibold">{fmt(r.total_amount)}</Td>
                <Td>{r.rooms_count ?? "-"}</Td>
              </tr>
            )) : (
              <tr><td colSpan={6} className="px-6 py-10 text-center text-slate-500">ไม่มีข้อมูลในช่วงที่เลือก</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Header({title, subtitle, icon:Icon, onReload, loading}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-200 inline-flex items-center justify-center">
            {Icon ? <Icon className="w-6 h-6 text-indigo-600" /> : null}
          </span>
          <div>
            <h2 className="text-xl font-bold text-slate-800">{title}</h2>
            <p className="text-slate-500 text-sm">{subtitle}</p>
          </div>
        </div>
        {onReload && (
          <button
            onClick={onReload}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
            title="โหลดใหม่"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            โหลดใหม่
          </button>
        )}
      </div>
    </div>
  );
}
function Th({children}) { return <th className="px-6 py-3 text-left text-sm font-semibold text-white">{children}</th>; }
function Td({children, className=""}) { return <td className={`px-6 py-3 ${className}`}>{children}</td>; }
function fmt(v){ const n = Number(v||0); return `฿ ${n.toLocaleString()}`; }
function SkeletonRows({cols=5, rows=6}) {
  return (
    <>
      {Array.from({length: rows}).map((_,ri)=>(
        <tr key={ri}>
          {Array.from({length: cols}).map((__,ci)=>(
            <td key={ci} className="px-6 py-3">
              <div className="h-4 w-28 bg-slate-200 rounded animate-pulse" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
