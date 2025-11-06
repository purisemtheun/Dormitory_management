import React, { useEffect, useState } from "react";
import reportApi from "../../api/reports.api";
import { CalendarDays, AlertTriangle, RefreshCw, FileWarning } from "lucide-react";

const todayStr = () => new Date().toISOString().slice(0,10);

export default function DebtsPanel() {
  const [asOf, setAsOf] = useState(todayStr());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const resp = await reportApi.debts(asOf);
      const data = Array.isArray(resp?.data) ? resp.data : Array.isArray(resp) ? resp : [];
      setRows(data);
    } catch (e) { console.error(e); setRows([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const total = rows.reduce((s,r)=> s + Number(r.total_amount||0), 0);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 inline-flex items-center justify-center">
              <FileWarning className="w-6 h-6 text-amber-600" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-slate-800">รายงานหนี้ค้างชำระ (แยกหมวด)</h2>
              <p className="text-slate-500 text-sm">ภาพรวมยอดค้าง ณ วันที่กำหนด</p>
            </div>
          </div>
          <button
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
            onClick={load}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            โหลดใหม่
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-end gap-3">
        <div>
          <label className="block text-sm text-slate-600 mb-1">ณ วันที่</label>
          <div className="relative">
            <CalendarDays className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="date"
              className="border rounded-lg pl-9 pr-3 py-2"
              value={asOf}
              onChange={e=>setAsOf(e.target.value)}
            />
          </div>
        </div>
        <button className="px-4 py-2 rounded-lg bg-indigo-600 text-white" onClick={load}>โหลด</button>
        <div className="ml-auto">
          <p className="text-slate-600 text-sm">รวมทั้งหมด</p>
          <p className="text-2xl font-extrabold">฿ {total.toLocaleString()}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-indigo-700">
              <Th>ห้อง</Th><Th>ผู้เช่า</Th><Th>ค่าเช่า (฿)</Th><Th>ค่าน้ำ (฿)</Th><Th>ค่าไฟ (฿)</Th><Th>รวม (฿)</Th><Th>เกินกำหนด (วัน)</Th><Th>เลขบิล</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <SkeletonRows cols={8} rows={7} />
            ) : rows.length ? rows.map((r,i)=>(
              <tr key={`${r.invoiceNo}-${i}`}>
                <Td>{r.roomNo}</Td>
                <Td>{r.tenant}</Td>
                <Td>{fmt(r.rent_amount)}</Td>
                <Td>{fmt(r.water_amount)}</Td>
                <Td>{fmt(r.electric_amount)}</Td>
                <Td className="font-semibold">{fmt(r.total_amount)}</Td>
                <Td className={Number(r.daysOverdue)>0 ? "text-amber-600 font-medium" : ""}>
                  {r.daysOverdue}
                </Td>
                <Td>{r.invoiceNo}</Td>
              </tr>
            )) : (
              <tr>
                <td colSpan={8} className="px-6 py-10 text-center text-slate-500">
                  <div className="inline-flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    ไม่มีข้อมูล
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function Th({children}){ return <th className="px-6 py-3 text-left text-sm font-semibold text-white">{children}</th>; }
function Td({children}){ return <td className="px-6 py-3">{children}</td>; }
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
