import React, { useMemo, useState } from "react";
import { CalendarDays, Search, Receipt, UserRound, Home, CheckCircle2, Clock, XCircle, AlertTriangle } from "lucide-react";

const arr = (d) =>
  Array.isArray(d) ? d :
  Array.isArray(d?.rows) ? d.rows :
  Array.isArray(d?.data) ? d.data :
  Array.isArray(d?.items) ? d.items :
  Array.isArray(d?.result) ? d.result : [];

const thb = (n) => Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (v) => {
  if (!v) return "";
  try {
    const d = new Date(v);
    if (Number.isNaN(+d)) return String(v).slice(0, 10);
    return d.toISOString().slice(0, 10);
  } catch {
    return String(v).slice(0, 10);
  }
};

const StatusBadge = ({ status }) => {
  const k = String(status || "").toLowerCase();
  const map = {
    approved: { text: "ชำระเสร็จสิ้น", cls: "bg-emerald-50 text-emerald-800 border-emerald-200", icon: <CheckCircle2 className="w-4 h-4" /> },
    paid:     { text: "ชำระเสร็จสิ้น", cls: "bg-emerald-50 text-emerald-800 border-emerald-200", icon: <CheckCircle2 className="w-4 h-4" /> },
    pending:  { text: "รอตรวจสอบ",   cls: "bg-amber-50 text-amber-800 border-amber-200",     icon: <Clock className="w-4 h-4" /> },
    rejected: { text: "ถูกปฏิเสธ",    cls: "bg-rose-50 text-rose-800 border-rose-200",         icon: <XCircle className="w-4 h-4" /> },
    overdue:  { text: "เกินกำหนด",    cls: "bg-rose-50 text-rose-800 border-rose-200",         icon: <AlertTriangle className="w-4 h-4" /> },
    partial:  { text: "ชำระบางส่วน",  cls: "bg-sky-50 text-sky-800 border-sky-200",           icon: <Clock className="w-4 h-4" /> },
    unpaid:   { text: "ยังไม่ชำระ",   cls: "bg-slate-50 text-slate-700 border-slate-200",      icon: <Clock className="w-4 h-4" /> },
  };
  const th = map[k] || { text: status || "-", cls: "bg-slate-50 text-slate-700 border-slate-200", icon: null };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${th.cls}`}>
      {th.icon}{th.text}
    </span>
  );
};

function KPI({ title, value, tone = "slate" }) {
  const toneMap = {
    slate:   "bg-white border-slate-200",
    indigo:  "bg-white border-indigo-200",
    amber:   "bg-white border-amber-200",
    emerald: "bg-white border-emerald-200",
  };
  return (
    <div className={`rounded-xl border ${toneMap[tone]} p-4 shadow-sm`}>
      <p className="text-sm text-slate-500">{title}</p>
      <p className="mt-1 text-2xl font-extrabold text-slate-900">{value}</p>
    </div>
  );
}
function Th({ children, className = "" }) { return <th className={`px-6 py-3.5 text-sm font-semibold ${className}`}>{children}</th>; }
function TdRight({ children, className = "" }) { return <td className={`px-6 py-4 text-right text-slate-800 ${className}`}>{children}</td>; }

export default function PaymentsTable({ data, range, setRange }) {
  const items = arr(data);

  const [status, setStatus] = useState("all"); // all | approved | pending | rejected | partial | unpaid | overdue
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return items.filter((p) => {
      const d = fmtDate(p.paid_at || p.payment_date || p.date || p.paidAt);
      if (range?.from && d && d < range.from) return false;
      if (range?.to && d && d > range.to) return false;

      if (status !== "all") {
        const raw = String(p.payment_status || p.pay_status || p.status || p.invoice_status || "").toLowerCase();
        if (raw !== status) return false;
      }

      if (!term) return true;
      const room   = String(p.room_no || p.room_number || p.roomNo || p.room || p.room_id || p.roomId || "").toLowerCase();
      const bill   = String(p.invoice_no || p.invoiceNo || p.invoice_id || p.invoiceId || p.bill_no || "").toLowerCase();
      const payer  = String(p.payer_name || p.tenant_name || p.fullname || p.name || p.tenant_fullname || p.payer || p.tenant_id || "").toLowerCase();
      return room.includes(term) || bill.includes(term) || payer.includes(term);
    });
  }, [items, status, q, range?.from, range?.to]);

  const kpi = useMemo(() => {
    const total = filtered.reduce((sum, p) => sum + Number(p.amount ?? p.total ?? p.amount_paid ?? 0), 0);
    const count = filtered.length;
    const pending = filtered.filter((p) =>
      ["pending"].includes(String(p.payment_status || p.pay_status || p.status || p.invoice_status || "").toLowerCase())
    ).length;
    return { total, count, pending };
  }, [filtered]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6">
        <div className="flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full border border-indigo-300 bg-indigo-50 flex items-center justify-center">
              <Receipt className="w-6 h-6 text-indigo-700" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-slate-900">การชำระเงิน</h3>
              <p className="text-slate-600 text-sm mt-0.5">สรุปยอดที่ชำระตามช่วงเวลา • ค้นหา • กรองสถานะ</p>
            </div>
          </div>
          <p className="text-xs text-slate-500">* ค้างชำระได้ไม่เกิน <b className="text-rose-600">2 เดือน</b> หรือ <b className="text-rose-600">60 วัน</b></p>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPI title="ยอดรวมช่วง" value={`฿ ${thb(kpi.total)}`} tone="indigo" />
        <KPI title="จำนวนใบชำระ" value={kpi.count} tone="slate" />
        <KPI title="รอตรวจสอบ" value={kpi.pending} tone="amber" />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-5">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-600">วันที่เริ่มต้น</span>
            <div className="relative">
              <CalendarDays className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input type="date" className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                value={range?.from || ""} onChange={(e) => setRange?.((p) => ({ ...p, from: e.target.value }))} />
            </div>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-600">ถึง</span>
            <div className="relative">
              <CalendarDays className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input type="date" className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                value={range?.to || ""} onChange={(e) => setRange?.((p) => ({ ...p, to: e.target.value }))} />
            </div>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-600">สถานะ</span>
            <select className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
              value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">ทั้งหมด</option>
              <option value="approved">ชำระเสร็จสิ้น</option>
              <option value="pending">รอตรวจสอบ</option>
              <option value="partial">ชำระบางส่วน</option>
              <option value="unpaid">ยังไม่ชำระ</option>
              <option value="rejected">ถูกปฏิเสธ</option>
              <option value="overdue">เกินกำหนด</option>
            </select>
          </label>

          <label className="md:col-span-2 flex flex-col gap-1">
            <span className="text-xs text-slate-600">ค้นหา</span>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                placeholder="เลขบิล / ห้อง / ชื่อผู้ชำระ" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </label>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="sticky top-0 z-10 bg-indigo-900 text-white shadow-md">
                <Th className="text-left">วันที่ชำระ</Th>
                <Th className="text-left">ห้อง</Th>
                <Th className="text-left">เลขที่บิล</Th>
                <Th className="text-right">จำนวนเงิน (฿)</Th>
                <Th className="text-left">ผู้ชำระ</Th>
                <Th className="text-left">สถานะ</Th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-lg text-slate-500 bg-slate-50/50">
                    ไม่พบรายการชำระเงินในรอบนี้
                  </td>
                </tr>
              ) : (
                filtered.map((p, i) => {
                  const paidDate = p.paid_at || p.payment_date || p.date || p.paidAt;
                  const room = p.room_no || p.room_number || p.roomNo || p.room || p.room_id || p.roomId || "-";
                  const invoiceNo = p.invoice_no || p.invoiceNo || p.invoice_id || p.invoiceId || p.bill_no || "-";
                  const amount = Number(p.amount ?? p.total ?? p.amount_paid ?? 0);
                  const payer = p.payer_name || p.tenant_name || p.fullname || p.name || p.tenant_fullname || p.payer || p.tenant_id || "-";
                  const rawStatus = p.payment_status || p.pay_status || p.status || p.invoice_status || "";

                  return (
                    <tr key={`${invoiceNo}-${i}`} className="hover:bg-indigo-50/30 transition-colors">
                      <td className="px-6 py-4">{fmtDate(paidDate)}</td>
                      <td className="px-6 py-4"><div className="flex items-center gap-2"><Home className="w-4 h-4 text-slate-400" /><span className="font-medium text-slate-900">{room}</span></div></td>
                      <td className="px-6 py-4"><div className="flex items-center gap-2"><Receipt className="w-4 h-4 text-slate-400" /><span className="font-medium">{invoiceNo}</span></div></td>
                      <TdRight className="font-semibold text-slate-900">{thb(amount)}</TdRight>
                      <td className="px-6 py-4"><div className="flex items-center gap-2 text-slate-800"><UserRound className="w-4 h-4 text-slate-400" /><span>{payer}</span></div></td>
                      <td className="px-6 py-4"><StatusBadge status={rawStatus} /></td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {filtered.length > 0 && (
              <tfoot>
                <tr className="bg-indigo-50 border-t border-indigo-100">
                  <td className="px-6 py-3 font-semibold text-slate-900" colSpan={3}>รวมทั้งสิ้น</td>
                  <TdRight className="font-bold text-slate-900">
                    {thb(filtered.reduce((s, p) => s + Number(p.amount ?? p.total ?? p.amount_paid ?? 0), 0))}
                  </TdRight>
                  <td className="px-6 py-3 text-slate-700" colSpan={2}>ใบชำระทั้งหมด {filtered.length} ใบ</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}