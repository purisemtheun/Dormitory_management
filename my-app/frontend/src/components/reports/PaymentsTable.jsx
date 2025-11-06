// frontend/src/sections/reports/PaymentsPanel.jsx
import React, { useEffect, useState } from "react";
import reportApi from "../../api/reports.api";

const todayStr = () => new Date().toISOString().slice(0,10);
const monthAgo = () => { const d=new Date(); d.setDate(d.getDate()-30); return d.toISOString().slice(0,10); };

export default function PaymentsPanel() {
  const [from, setFrom] = useState(monthAgo());
  const [to, setTo] = useState(todayStr());
  const [status, setStatus] = useState("ทั้งหมด"); // แสดงทั้งหมดในตาราง (ฟิลเตอร์ภายหลัง)
  const [rows, setRows] = useState([]);

  const load = async () => {
    try {
      const resp = await reportApi.payments(from, to);
      const data = Array.isArray(resp?.data) ? resp.data : Array.isArray(resp) ? resp : [];
      setRows(data);
    } catch (e) {
      console.error("payments error", e);
      setRows([]);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = rows.filter(r => {
    if (status === "ทั้งหมด") return true;
    return String(r.payment_status || "").toLowerCase() === status;
  });

  const total = filtered.reduce((s,r)=> s + Number(r.amount||0), 0);

  return (
    <div className="space-y-6">
      <Header title="การชำระเงิน" subtitle="สรุปยอดที่ชำระภายในช่วงวันที่ • ค้นหา • กรองสถานะ" />

      <div className="bg-white rounded-xl border p-4 grid grid-cols-1 md:grid-cols-5 gap-3">
        <div>
          <label className="block text-sm text-slate-600 mb-1">วันที่เริ่มต้น</label>
          <input type="date" className="border rounded-lg px-3 py-2" value={from} onChange={e=>setFrom(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm text-slate-600 mb-1">ถึง</label>
          <input type="date" className="border rounded-lg px-3 py-2" value={to} onChange={e=>setTo(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm text-slate-600 mb-1">สถานะ</label>
          <select className="border rounded-lg px-3 py-2" value={status} onChange={e=>setStatus(e.target.value)}>
            <option value="ทั้งหมด">ทั้งหมด</option>
            <option value="approved">approved</option>
            <option value="pending">pending</option>
            <option value="rejected">rejected</option>
          </select>
        </div>
        <div className="flex items-end"><button className="px-4 py-2 rounded-lg bg-indigo-600 text-white" onClick={load}>โหลด</button></div>
        <div className="flex items-end justify-end">
          <div>
            <p className="text-slate-600 text-sm">ยอดรวมช่วงนี้</p>
            <p className="text-2xl font-extrabold">฿ {total.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
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
          <tbody className="divide-y">
            {filtered.length ? filtered.map((r,i)=>(
              <tr key={`${r.invoice_no}-${i}`}>
                <Td>{(r.paid_at || "").toString().slice(0,10)}</Td>
                <Td>{r.room_number || "-"}</Td>
                <Td>{r.invoice_no || "-"}</Td>
                <Td>{r.tenant_name || "-"}</Td>
                <Td className="font-semibold">฿ {(Number(r.amount||0)).toLocaleString()}</Td>
                <Td>{r.payment_status || "-"}</Td>
              </tr>
            )) : <tr><td colSpan={6} className="px-6 py-10 text-center text-slate-500">ไม่พบรายการชำระเงิน</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Header({title, subtitle}) {
  return (
    <div className="bg-white rounded-xl border p-5">
      <h2 className="text-xl font-bold text-slate-800">{title}</h2>
      <p className="text-slate-500 text-sm">{subtitle}</p>
    </div>
  );
}
function Th({children}){ return <th className="px-6 py-3 text-left text-sm font-semibold text-white">{children}</th>; }
function Td({children}){ return <td className="px-6 py-3">{children}</td>; }
