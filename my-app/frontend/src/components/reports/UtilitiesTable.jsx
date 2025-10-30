// src/components/reports/UtilitiesTable.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { reportApi } from "../../api/reports.api";
import { Droplet, Zap } from "lucide-react";

// --------- helpers ----------
const val = (v, d = 0) => (v === null || v === undefined || v === "" ? d : v);
const num = (v) => Number(val(v, 0)) || 0;

const roomLabel = (r) =>
  String(r.room_number ?? r.roomNumber ?? r.room_no ?? r.number ?? r.room ?? "-");

const monthLabel = (ym) => {
  if (!ym) return "-";
  const [y, m] = ym.split("-");
  const dt = new Date(`${y}-${m}-01T00:00:00`);
  return dt.toLocaleDateString("th-TH", { month: "long", year: "numeric" });
};

export default function UtilitiesTable({ data = [], period = "", setPeriod }) {
  // Data/UI state
  const [rows, setRows] = useState([]);
  const [savingId, setSavingId] = useState(null);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5); // default 5 รายการ/หน้า

  // --------- API method fallbacks (ชื่อยืดหยุ่น) ----------
  const getMonthlyFn =
    reportApi?.getMeterMonthlySimple ||
    reportApi?.meterMonthlySimple ||
    reportApi?.meterMonthly ||
    reportApi?.getMeterMonthly;

  const saveFn =
    reportApi?.meterSaveSimple ||
    reportApi?.saveMeterSimple ||
    reportApi?.meterSaveReading;

  // --------- fetch month ----------
  const fetchMonth = useCallback(async () => {
    if (!period || !getMonthlyFn) return;
    try {
      setLoading(true);
      const res =
        (getMonthlyFn.length > 1 ? await getMonthlyFn({ ym: period }) : await getMonthlyFn(period)) || [];
      const next = Array.isArray(res) ? res : res?.data ?? [];
      setRows(next);
      setPage(1); // กลับไปหน้าแรกทุกครั้งที่โหลดใหม่
    } catch (e) {
      console.error(e);
      setMsg(`โหลดข้อมูลล้มเหลว: ${e?.message || "กรุณาลองอีกครั้ง"}`);
      setTimeout(() => setMsg(""), 2200);
    } finally {
      setLoading(false);
    }
  }, [getMonthlyFn, period]);

  useEffect(() => setRows(Array.isArray(data) ? data : []), [data]);

  // --------- summary ----------
  const summary = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        const wu = num(r.water_units);
        const eu = num(r.electric_units);
        const wr = num(r.water_rate);
        const er = num(r.electric_rate);
        acc.waterUnits += wu;
        acc.elecUnits += eu;
        acc.waterAmount += wu * wr;
        acc.elecAmount += eu * er;
        return acc;
      },
      { waterUnits: 0, elecUnits: 0, waterAmount: 0, elecAmount: 0 }
    );
  }, [rows]);

  // --------- local edit ----------
  const updateLocal = (id, patch) => {
    setRows((prev) => prev.map((r) => (r.room_id === id ? { ...r, ...patch } : r)));
  };

  // --------- save one row ----------
  const saveRow = async (r) => {
    try {
      if (!saveFn) {
        setMsg("ไม่พบเมธอด reportApi สำหรับบันทึก (meterSaveSimple)");
        setTimeout(() => setMsg(""), 2200);
        return;
      }
      setSavingId(r.room_id);
      setMsg("");

      const payload = {
        room_id: r.room_id,
        period_ym: period,
        water_units: num(r.water_units),
        electric_units: num(r.electric_units),
        water_rate: num(r.water_rate),
        electric_rate: num(r.electric_rate),
      };

      await saveFn(payload);
      await fetchMonth();

      setMsg("บันทึกแล้ว");
      setTimeout(() => setMsg(""), 1600);
    } catch (e) {
      setMsg(`บันทึกล้มเหลว: ${e.message || "กรุณาลองอีกครั้ง"}`);
    } finally {
      setSavingId(null);
    }
  };

  // --------- pagination calc ----------
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startIdx = (page - 1) * pageSize;
  const pageRows = rows.slice(startIdx, startIdx + pageSize);

  const handleMonthChange = (e) => setPeriod?.(e.target.value);

  return (
    <div className="mx-auto w-full max-w-[1480px] space-y-6">
      {/* Header card */}
      <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* ไอคอนวงกลม */}
            <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-indigo-50 border border-indigo-200">
              <div className="flex items-center gap-1.5">
                <Droplet className="w-5 h-5 text-sky-600" />
                <Zap className="w-5 h-5 text-amber-500" />
              </div>
            </span>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">รายงานค่าน้ำ/ค่าไฟ</h2>
              <p className="text-slate-600 text-sm mt-0.5">
                ป้อนหน่วยและเรตของแต่ละห้อง • บันทึกทีละแถว • โหลดข้อมูลเดือนล่าสุด
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-slate-700">เลือกงวด:</label>
            <input
              type="month"
              value={period || ""}
              onChange={handleMonthChange}
              className="w-[180px] rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-4 focus:ring-indigo-100"
            />
            <button
              className="rounded-lg bg-indigo-600 text-white px-4 py-2 font-medium hover:bg-indigo-700 disabled:opacity-60"
              onClick={fetchMonth}
              disabled={!period || loading}
              title="โหลดข้อมูลล่าสุดของเดือนนี้จากเซิร์ฟเวอร์"
            >
              {loading ? "กำลังโหลด…" : "โหลดใหม่"}
            </button>
          </div>
        </div>
      </div>

      {/* Summary bar */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 text-amber-900 p-4">
        <div className="font-semibold">สรุปยอด {monthLabel(period)}</div>
        <div className="mt-1 text-sm sm:text-base">
          หน่วยน้ำรวม: <b>{summary.waterUnits.toLocaleString()}</b> หน่วย (
          <b>
            {summary.waterAmount.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </b>{" "}
          บาท)
          <span className="px-2 text-amber-400">•</span>
          หน่วยไฟรวม: <b>{summary.elecUnits.toLocaleString()}</b> หน่วย (
          <b>
            {summary.elecAmount.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </b>{" "}
          บาท)
        </div>
      </div>

      {/* Table card */}
      <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
        {/* Table top controls */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4">
          <div className="text-sm text-slate-600">
            แสดงผล <b>{pageRows.length}</b> จากทั้งหมด <b>{total}</b> แถว
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-700">แถว/หน้า</span>
            <select
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value) || 5);
                setPage(1);
              }}
            >
              {[5, 10, 15, 20].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="sticky top-0 z-10 bg-indigo-900 text-white text-sm">
                <th className="px-4 py-3 text-left w-16">#</th>
                <th className="px-4 py-3 text-left w-24">ห้อง</th>
                <th className="px-4 py-3 text-left">ผู้เช่า</th>

                <th className="px-4 py-3 text-center w-32">หน่วยน้ำ</th>
                <th className="px-4 py-3 text-center w-36">เรตน้ำ (บ./หน่วย)</th>
                <th className="px-4 py-3 text-right w-32">ค่าน้ำ (บ.)</th>

                <th className="px-4 py-3 text-center w-32">หน่วยไฟ</th>
                <th className="px-4 py-3 text-center w-36">เรตไฟ (บ./หน่วย)</th>
                <th className="px-4 py-3 text-right w-32">ค่าไฟ (บ.)</th>

                <th className="px-4 py-3 text-right w-32">รวม (บ.)</th>
                <th className="px-4 py-3 text-center w-24">บันทึก</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-slate-800">
              {pageRows.length ? (
                pageRows.map((r, idx) => {
                  const wu = num(r.water_units);
                  const eu = num(r.electric_units);
                  const wr = num(r.water_rate);
                  const er = num(r.electric_rate);
                  const wAmt = wu * wr;
                  const eAmt = eu * er;
                  const totalAmt = wAmt + eAmt;

                  return (
                    <tr key={r.room_id} className="hover:bg-slate-50/60 text-[15px]">
                      <td className="px-4 py-3">{startIdx + idx + 1}</td>
                      <td className="px-4 py-3 font-semibold">{roomLabel(r)}</td>
                      <td className="px-4 py-3 max-w-[220px] whitespace-nowrap overflow-hidden text-ellipsis">
                        {r.tenant_name ?? r.tenant ?? "-"}
                      </td>

                      {/* WATER UNIT */}
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          step="1"
                          value={r.water_units ?? ""}
                          onChange={(e) =>
                            updateLocal(r.room_id, { water_units: e.target.value })
                          }
                          className="w-full text-center rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-4 focus:ring-indigo-100"
                        />
                      </td>

                      {/* WATER RATE */}
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          step="0.01"
                          value={r.water_rate ?? ""}
                          onChange={(e) =>
                            updateLocal(r.room_id, { water_rate: e.target.value })
                          }
                          className="w-full text-center rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-4 focus:ring-indigo-100"
                        />
                      </td>

                      <td className="px-4 py-3 text-right font-medium">
                        {wAmt.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>

                      {/* ELECTRIC UNIT */}
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          step="1"
                          value={r.electric_units ?? ""}
                          onChange={(e) =>
                            updateLocal(r.room_id, { electric_units: e.target.value })
                          }
                          className="w-full text-center rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-4 focus:ring-indigo-100"
                        />
                      </td>

                      {/* ELECTRIC RATE */}
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          step="0.01"
                          value={r.electric_rate ?? ""}
                          onChange={(e) =>
                            updateLocal(r.room_id, { electric_rate: e.target.value })
                          }
                          className="w-full text-center rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-4 focus:ring-indigo-100"
                        />
                      </td>

                      <td className="px-4 py-3 text-right font-medium">
                        {eAmt.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>

                      <td className="px-4 py-3 text-right font-bold">
                        {totalAmt.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>

                      <td className="px-4 py-2 text-center">
                        <button
                          className="rounded-lg bg-indigo-600 text-white px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
                          disabled={savingId === r.room_id || loading}
                          onClick={() => saveRow(r)}
                        >
                          {savingId === r.room_id ? "กำลังบันทึก…" : "บันทึก"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={11}
                    className="px-6 py-16 text-center text-lg text-slate-500 bg-slate-50/50"
                  >
                    ไม่พบข้อมูลค่าน้ำ/ค่าไฟสำหรับงวด {period || "-"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-slate-100">
          <div className="text-sm text-slate-600">
            หน้า <b>{page}</b> / {totalPages}
          </div>
          <div className="flex items-center gap-2">
            <button
              className="px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              ก่อนหน้า
            </button>
            <button
              className="px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              ถัดไป
            </button>
          </div>
        </div>
      </div>

      {/* Inline message */}
      {msg && (
        <div
          className={`rounded-xl border px-4 py-3 ${
            msg.startsWith("บันทึกแล้ว")
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-rose-200 bg-rose-50 text-rose-900"
          }`}
        >
          {msg}
        </div>
      )}
    </div>
  );
}
