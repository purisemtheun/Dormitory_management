// src/pages/admin/AdminRoomReservationsPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { CalendarCheck2, RefreshCw, User2, Home, CalendarDays, CheckCircle2, XCircle } from "lucide-react";
import { getToken } from "../../utils/auth";

const api = {
  list: async (page = 1, pageSize = 10) => {
    const r = await fetch(`/api/rooms/reservations?status=pending&page=${page}&pageSize=${pageSize}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    // fallback: บางโปรเจกต์ยังไม่มี API → คืน [] เงียบ ๆ
    const text = await r.text();
    let d = {};
    try { d = JSON.parse(text); } catch { return { rows: [], total: 0 }; }
    if (!r.ok) return { rows: [], total: 0 };
    const rows = Array.isArray(d?.data) ? d.data : (Array.isArray(d) ? d : []);
    const total = Number(d?.total ?? rows.length ?? 0);
    return { rows, total };
  },
  decide: async (id, action) => {
    const r = await fetch(`/api/rooms/reservations/${id}/decision`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify({ action }), // 'approve' | 'reject'
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d?.error || d?.message || "ดำเนินการไม่สำเร็จ");
    return d;
  },
};

const badge = (status) => {
  const s = String(status || "").toLowerCase();
  if (s === "pending")     return "bg-amber-50 text-amber-700 ring-amber-200";
  if (s === "approved")    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (s === "rejected")    return "bg-rose-50 text-rose-700 ring-rose-200";
  return "bg-slate-100 text-slate-700 ring-slate-200";
};

export default function AdminRoomReservationsPage() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [busyId, setBusyId] = useState(null);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total]);

  const load = async (p = page) => {
    try {
      setLoading(true);
      setErr("");
      const { rows, total } = await api.list(p, pageSize);
      setRows(rows);
      setTotal(total);
    } catch (e) {
      setErr(e.message || "โหลดรายการไม่สำเร็จ");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(page); /* eslint-disable-next-line */ }, [page]);

  const decide = async (id, action) => {
    if (!["approve","reject"].includes(action)) return;
    if (!window.confirm(action === "approve" ? "ยืนยันอนุมัติการจอง?" : "ยืนยันปฏิเสธการจอง?")) return;
    try {
      setBusyId(id);
      await api.decide(id, action);
      // อัปเดต UI ทันที: เอาออกจากหน้า pending
      setRows((list) => list.filter((x) => x.reservation_id !== id));
      setTotal((n) => Math.max(0, n - 1));
    } catch (e) {
      alert(e.message || "ดำเนินการไม่สำเร็จ");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {/* Header Card */}
        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 overflow-hidden">
          <div className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-3">
            <CalendarCheck2 size={18} />
            <h2 className="text-base sm:text-lg font-semibold">อนุมัติการจองห้อง</h2>
          </div>
          <div className="p-5 sm:p-6">
            <p className="text-sm text-slate-600">
              ตรวจสอบคำขอจองจากผู้เช่าใหม่ และกดอนุมัติเพื่อผูกห้องให้ผู้ใช้งาน (สถานะห้องจะเปลี่ยนเป็น <span className="font-medium">มีผู้อาศัย</span> อัตโนมัติ)
            </p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => load(1)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 text-white text-sm hover:bg-slate-900"
              >
                <RefreshCw size={16} /> รีเฟรช
              </button>
            </div>
          </div>
        </div>

        {/* Table Card */}
        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 overflow-hidden">
          {/* ตารางหัวน้ำเงินตัวอักษรขาว */}
          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full border-separate border-spacing-0">
              <thead>
                <tr className="bg-indigo-600 text-white">
                  <th className="text-left font-semibold px-4 py-3">รหัสจอง</th>
                  <th className="text-left font-semibold px-4 py-3">ผู้ขอจอง</th>
                  <th className="text-left font-semibold px-4 py-3">ห้อง</th>
                  <th className="text-left font-semibold px-4 py-3">วันที่ขอจอง</th>
                  <th className="text-left font-semibold px-4 py-3">สถานะ</th>
                  <th className="text-left font-semibold px-4 py-3">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={6} className="px-4 py-6 text-slate-500">กำลังโหลด...</td></tr>
                )}
                {!loading && err && (
                  <tr><td colSpan={6} className="px-4 py-6 text-rose-600">{err}</td></tr>
                )}
                {!loading && !err && rows.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-6 text-slate-500">— ไม่มีคำขอจอง —</td></tr>
                )}

                {rows.map((r) => (
                  <tr key={r.reservation_id} className="border-b border-slate-100">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{r.reservation_code || r.reservation_id}</div>
                      <div className="text-xs text-slate-400">{r.created_at?.slice(0,19)?.replace("T"," ") || ""}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <User2 className="w-4 h-4 text-slate-400" />
                        <div>
                          <div className="font-medium text-slate-800">{r.user_name || r.fullname || r.email || `User#${r.user_id}`}</div>
                          <div className="text-xs text-slate-500">ID: {r.user_id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Home className="w-4 h-4 text-slate-400" />
                        <div>
                          <div className="font-medium text-slate-800">ห้อง {r.room_number || r.room_id}</div>
                          <div className="text-xs text-slate-500">{r.building_name || r.floor ? `ชั้น ${r.floor || "-"}` : ""}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <CalendarDays className="w-4 h-4 text-slate-400" />
                        <div className="text-sm text-slate-700">{(r.requested_at || r.created_at || "").slice(0,10)}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ring-1 ${badge(r.status)}`}>
                        {r.status === "pending" ? "รออนุมัติ" : r.status === "approved" ? "อนุมัติแล้ว" : r.status === "rejected" ? "ปฏิเสธแล้ว" : (r.status || "-")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          disabled={busyId === r.reservation_id}
                          onClick={() => decide(r.reservation_id, "approve")}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-700 disabled:opacity-60"
                          title="อนุมัติและผูกห้องให้ผู้ใช้"
                        >
                          <CheckCircle2 size={16} /> อนุมัติ
                        </button>
                        <button
                          disabled={busyId === r.reservation_id}
                          onClick={() => decide(r.reservation_id, "reject")}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-600 text-white text-sm hover:bg-rose-700 disabled:opacity-60"
                          title="ปฏิเสธคำขอจอง"
                        >
                          <XCircle size={16} /> ปฏิเสธ
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <div className="text-sm text-slate-500">
              รวม {total} รายการ · หน้า {page} / {totalPages}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-2 rounded-lg border border-slate-200 text-sm hover:bg-slate-50 disabled:opacity-50"
              >
                ก่อนหน้า
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-2 rounded-lg border border-slate-200 text-sm hover:bg-slate-50 disabled:opacity-50"
              >
                ถัดไป
              </button>
            </div>
          </div>
        </div>

        <div className="text-xs text-slate-400">
          เมื่ออนุมัติสำเร็จ ระบบควร: ผูกผู้ใช้กับห้อง (สร้าง/อัปเดตแถวใน <code>tenants</code>), เปลี่ยน <code>rooms.status</code> เป็น <code>occupied</code>, และอัปเดตการจองเป็น <code>approved</code>.
        </div>
      </div>
    </div>
  );
}
