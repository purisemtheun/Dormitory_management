import React, { useEffect, useState } from "react";
import reportApi from "../../api/reports.api";
import { CalendarRange, RefreshCw, Receipt } from "lucide-react";

const todayStr = () => new Date().toISOString().slice(0,10);
const weekAgo  = () => { const d = new Date(); d.setDate(d.getDate()-7); return d.toISOString().slice(0,10); };

export default function RevenueDailyPanel() {
  const [from, setFrom] = useState(weekAgo());
  const [to, setTo] = useState(todayStr());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const resp = await reportApi.revenueDaily(from, to);
      const data = Array.isArray(resp?.data) ? resp.data : Array.isArray(resp) ? resp : [];
      setRows(data);
    } catch (e) {
      console.error("revenueDaily error", e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const total = rows.reduce((s, r) => s + Number(r.revenue || 0), 0);

  return (
    <div className="space-y-6">
      <Header title="รายรับรายวัน" subtitle="ยอดที่ชำระแล้ว (approved) ตามช่วงวันที่" onReload={fetchData} loading={loading} />

      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col md:flex-row gap-3 md:items-end">
        <div>
          <label className="block text-sm text-slate-600 mb-1">วันที่เริ่มต้น</label>
          <input type="date" className="border rounded-lg px-3 py-2" value={from} onChange={e=>setFrom(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm text-slate-600 mb-1">ถึง</label>
          <input type="date" className="border rounded-lg px-3 py-2" value={to} onChange={e=>setTo(e.target.value)} />
        </div>
        <div>
          <button onClick={fetchData} className="px-4 py-2 rounded-lg bg-indigo-600 text-white inline-flex items-center gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            โหลด
          </button>
        </div>
        <div className="md:ml-auto">
          <p className="text-slate-600 text-sm">รวมช่วงนี้</p>
          <p className="text-2xl font-extrabold inline-flex items-center gap-2">
            <Receipt className="w-5 h-5 text-indigo-600" />
            ฿ {total.toLocaleString()}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-indigo-700"><Th>วันที่</Th><Th>จำนวนใบเสร็จ</Th><Th>รายรับ (฿)</Th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <SkeletonRows cols={3} rows={7} />
            ) : rows.length ? rows.map(r => (
              <tr key={r.date || r.period}>
                <Td>{r.date || r.period}</Td>
                <Td>{r.paid ?? "-"}</Td>
                <Td className="font-semibold">฿ {(Number(r.revenue||0)).toLocaleString()}</Td>
              </tr>
            )) : (
              <tr><td colSpan={3} className="px-6 py-10 text-center text-slate-500">ไม่มีข้อมูล</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Header({title, subtitle, onReload, loading}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-200 inline-flex items-center justify-center">
            <CalendarRange className="w-6 h-6 text-indigo-600" />
          </span>
          <div>
            <h2 className="text-xl font-bold text-slate-800">{title}</h2>
            <p className="text-slate-500 text-sm">{subtitle}</p>
          </div>
        </div>
        <button
          onClick={onReload}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          โหลดใหม่
        </button>
      </div>
    </div>
  );
}
function Th({children}){ return <th className="px-6 py-3 text-left text-sm font-semibold text-white">{children}</th>; }
function Td({children}){ return <td className="px-6 py-3">{children}</td>; }
function SkeletonRows({cols=3, rows=6}) {
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
