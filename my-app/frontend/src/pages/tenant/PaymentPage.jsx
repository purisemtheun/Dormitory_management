// frontend/src/sections/reports/PaymentsPanel.jsx
import React, { useEffect, useState } from "react";
import reportApi from "../../api/reports.api";
import { CalendarDays, Filter, RefreshCw, Receipt, BadgeCheck } from "lucide-react";

const todayStr = () => new Date().toISOString().slice(0,10);
const monthAgo = () => { const d=new Date(); d.setDate(d.getDate()-30); return d.toISOString().slice(0,10); };

export default function PaymentsPanel() {
  const [from, setFrom] = useState(monthAgo());
  const [to, setTo] = useState(todayStr());
  const [status, setStatus] = useState("ทั้งหมด"); // ใช้ label ไทยใน UI แต่ค่าที่ส่งยังคง 'approved'/'pending'/'rejected'
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const resp = await reportApi.payments(from, to);
      const data = Array.isArray(resp?.data) ? resp.data : Array.isArray(resp) ? resp : [];
      setRows(data);
    } catch (e) {
      console.error("payments error", e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = rows.filter(r => {
    if (status === "ทั้งหมด") return true;
    return String(r.payment_status || "").toLowerCase() === status; // status จะเป็น approved/pending/rejected
  });

  const total = filtered.reduce((s,r)=> s + Number(r.amount||0), 0);

  return (
    <div className="space-y-6">
      <Header title="การชำระเงิน" subtitle="สรุปยอดที่ชำระภายในช่วงวันที่ • กรองสถานะ" onReload={load} loading={loading} />

      <div className="bg-white rounded-xl border border-slate-200 p-4 grid grid-cols-1 md:grid-cols-5 gap-3">
        <div>
          <label className="block text-sm text-slate-600 mb-1">วันที่เริ่มต้น</label>
          <div className="relative">
            <CalendarDays className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input type="date" className="border rounded-lg pl-9 pr-3 py-2 w-full" value={from} onChange={e=>setFrom(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="block text-sm text-slate-600 mb-1">ถึง</label>
          <div className="relative">
            <CalendarDays className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input type="date" className="border rounded-lg pl-9 pr-3 py-2 w-full" value={to} onChange={e=>setTo(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="block text-sm text-slate-600 mb-1">สถานะ</label>
          <div className="relative">
            <Filter className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            {/* แสดง label ไทย แต่ค่า value เป็นอังกฤษเพื่อแมตช์กับ API */}
            <select
              className="border rounded-lg pl-9 pr-3 py-2 w-full"
              value={status}
              onChange={e=>setStatus(e.target.value)}
            >
              <option value="ทั้งหมด">ทั้งหมด</option>
              <option value="approved">ชำระเงินสำเร็จแล้ว</option>
              <option value="pending">รอดำเนินการ</option>
              <option value="rejected">ปฏิเสธ</option>
            </select>
          </div>
        </div>
        <div className="flex items-end">
          <button className="px-4 py-2 rounded-lg bg-indigo-600 text-white inline-flex items-center gap-2" onClick={load}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            โหลด
          </button>
        </div>
        <div className="flex items-end justify-end">
          <div>
            <p className="text-slate-600 text-sm">ยอดรวมช่วงนี้</p>
            <p className="text-2xl font-extrabold inline-flex items-center gap-2">
              <Receipt className="w-5 h-5 text-indigo-600" />
              ฿ {total.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-indigo-700">
              <Th>วันที่ชำระ</Th>
              <Th>ห้อง</Th>
              <Th>เลขบิล</Th>
              <Th>ผู้จ่าย</Th>
              <Th>ยอด (฿)</Th>
              <Th>สถานะ</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <SkeletonRows cols={6} rows={8} />
            ) : filtered.length ? filtered.map((r,i)=>(
              <tr key={`${r.invoice_no}-${i}`}>
                <Td>{(r.paid_at || "").toString().slice(0,10)}</Td>
                <Td>{r.room_number || "-"}</Td>
                <Td>{r.invoice_no || "-"}</Td>
                <Td>{r.tenant_name || "-"}</Td>
                <Td className="font-semibold">฿ {(Number(r.amount||0)).toLocaleString()}</Td>
                <Td>{statusBadge(r.payment_status)}</Td>
              </tr>
            )) : <tr><td colSpan={6} className="px-6 py-10 text-center text-slate-500">ไม่พบรายการชำระเงิน</td></tr>}
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
            <BadgeCheck className="w-6 h-6 text-indigo-600" />
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

function statusBadge(sraw) {
  const s = String(sraw || "-").toLowerCase();
  if (s === "approved") {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs bg-emerald-50 text-emerald-700 border-emerald-300">
        ชำระเงินสำเร็จแล้ว
      </span>
    );
  }
  if (s === "pending") {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs bg-amber-50 text-amber-700 border-amber-300">
        รอดำเนินการ
      </span>
    );
  }
  if (s === "rejected") {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs bg-rose-50 text-rose-700 border-rose-300">
        ปฏิเสธ
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs bg-slate-50 text-slate-600 border-slate-300">
      -
    </span>
  );
}

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
