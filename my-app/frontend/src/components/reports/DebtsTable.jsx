import React, { useMemo, useState, useEffect } from "react";
import { CircleAlert, CalendarDays, UserRound, Home, Coins, Droplet, Zap } from "lucide-react";

const thb = (n) => Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const arr = (d) =>
  Array.isArray(d) ? d :
  Array.isArray(d?.rows) ? d.rows :
  Array.isArray(d?.data) ? d.data :
  Array.isArray(d?.items) ? d.items :
  Array.isArray(d?.result) ? d.result : [];

/**
 * props:
 *  - data: array หรือ object ที่มี rows/data/items/result
 *  - asOf: 'YYYY-MM-DD'
 *  - setAsOf: fn
 */
export default function DebtsTable({ data = [], asOf = "", setAsOf }) {
  const items = arr(data);

  const PAGE_SIZE = 5;
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [asOf, items.length]);

  const totalPages = useMemo(() => Math.max(1, Math.min(10, Math.ceil(Math.max(items.length, 1) / PAGE_SIZE))), [items.length]);
  const start = (page - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  const pageRows = items.slice(start, end);

  const goto = (p) => { if (p >= 1 && p <= totalPages) setPage(p); };

  const sum = useMemo(() => items.reduce(
    (acc, r) => {
      acc.rent  += Number(r.rent_amount || 0);
      acc.water += Number(r.water_amount || 0);
      acc.elec  += Number(r.electric_amount || 0);
      acc.total += Number(r.total_amount ?? r.amount ?? 0);
      return acc;
    }, { rent: 0, water: 0, elec: 0, total: 0 }
  ), [items]);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full border border-indigo-300 bg-indigo-50 flex items-center justify-center">
              <CircleAlert className="w-6 h-6 text-indigo-700" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-slate-900">รายงานหนี้ค้างชำระ (แยกหมวด)</h3>
              <p className="text-slate-600 text-sm mt-0.5">แสดงยอดค้างที่ยังไม่ชำระ โดยแยก <b>ค่าเช่า / ค่าน้ำ / ค่าไฟ</b> และยอดรวมต่อใบแจ้งหนี้</p>
              <p className="text-rose-600 text-xs mt-1">* ค้างชำระได้ไม่เกิน <b>2 เดือน</b> หรือ <b>60 วัน</b></p>
            </div>
          </div>

          <label className="flex items-center gap-2 bg-white border border-slate-300 rounded-lg px-3 py-2">
            <CalendarDays className="w-5 h-5 text-slate-500" />
            <span className="text-sm text-slate-700">ณ วันที่</span>
            <input
              type="date" value={asOf || ""} onChange={(e) => setAsOf?.(e.target.value)}
              className="w-[10.5rem] pl-2 pr-2 py-1.5 border-0 focus:ring-0 focus:outline-none text-slate-900"
            />
          </label>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="sticky top-0 z-10 bg-indigo-900 text-white shadow-md">
                <Th className="text-left">ห้อง</Th>
                <Th className="text-left">ผู้เช่า</Th>
                <Th className="text-right">ค่าเช่า (฿)</Th>
                <Th className="text-right">ค่าน้ำ (฿)</Th>
                <Th className="text-right">ค่าไฟ (฿)</Th>
                <Th className="text-right">รวมทั้งหมด (฿)</Th>
                <Th className="text-center">เกินกำหนด (วัน)</Th>
                <Th className="text-left">เลขที่ใบแจ้งหนี้</Th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center text-lg text-slate-500 bg-slate-50/50">
                    ไม่มีข้อมูลหนี้ค้างชำระ
                  </td>
                </tr>
              ) : (
                pageRows.map((x, i) => {
                  const room = x.roomNo || x.room_number || x.room_id || "-";
                  const tenant = x.tenant || x.tenant_name || "-";
                  const invNo = x.invoiceNo || x.invoice_no || "-";
                  const overdue = x.daysOverdue ?? x.days_overdue ?? "-";
                  return (
                    <tr key={invNo !== "-" ? invNo : `${i}-${room}`} className="hover:bg-indigo-50/30 transition-colors">
                      <td className="px-6 py-4"><div className="flex items-center gap-2"><Home className="w-4 h-4 text-slate-400" /><span className="font-semibold text-slate-900">{room}</span></div></td>
                      <td className="px-6 py-4"><div className="flex items-center gap-2 text-slate-800"><UserRound className="w-4 h-4 text-slate-400" /><span>{tenant}</span></div></td>
                      <TdRight>{thb(x.rent_amount)}</TdRight>
                      <TdRight><span className="inline-flex items-center gap-1"><Droplet className="w-4 h-4" />{thb(x.water_amount)}</span></TdRight>
                      <TdRight><span className="inline-flex items-center gap-1"><Zap className="w-4 h-4" />{thb(x.electric_amount)}</span></TdRight>
                      <TdRight className="font-bold text-slate-900">{thb(x.total_amount ?? x.amount)}</TdRight>
                      <td className="px-6 py-4 text-center">{overdue}</td>
                      <td className="px-6 py-4"><div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-slate-300 text-slate-800 bg-white"><Coins className="w-4 h-4 text-slate-500" /><span className="font-medium">{invNo}</span></div></td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {items.length > 0 && (
              <tfoot>
                <tr className="bg-indigo-50 border-t border-indigo-100">
                  <td className="px-6 py-3 font-semibold text-slate-900" colSpan={2}>รวมทั้งสิ้น</td>
                  <TdRight className="font-semibold">{thb(sum.rent)}</TdRight>
                  <TdRight className="font-semibold">{thb(sum.water)}</TdRight>
                  <TdRight className="font-semibold">{thb(sum.elec)}</TdRight>
                  <TdRight className="font-bold text-slate-900">{thb(sum.total)}</TdRight>
                  <td className="px-6 py-3" colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-slate-600">
            ทั้งหมด <span className="font-semibold">{items.length}</span> รายการ | หน้า <span className="font-semibold">{page}</span> / <span className="font-semibold">{totalPages}</span> | แสดง <span className="font-semibold">{PAGE_SIZE}</span> รายการ/หน้า
          </p>

          <div className="flex items-center gap-2">
            <button className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors text-slate-700 font-medium disabled:opacity-50"
              disabled={page <= 1} onClick={() => goto(page - 1)}>ก่อนหน้า</button>

            <select className="px-3 py-2 text-sm border border-slate-300 rounded-lg" value={page} onChange={(e) => goto(Number(e.target.value))}>
              {Array.from({ length: totalPages }).map((_, i) => (<option key={i + 1} value={i + 1}>{i + 1}</option>))}
            </select>

            <button className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors text-slate-700 font-medium disabled:opacity-50"
              disabled={page >= totalPages} onClick={() => goto(page + 1)}>ถัดไป</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Th({ children, className = "" }) { return <th className={`px-6 py-3.5 text-base font-semibold ${className}`}>{children}</th>; }
function TdRight({ children, className = "" }) { return <td className={`px-6 py-4 text-right text-slate-800 ${className}`}>{children}</td>; }