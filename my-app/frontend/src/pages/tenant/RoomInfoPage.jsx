// src/pages/tenant/RoomInfoPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { roomApi } from "../../api/room.api";
import { Home, Hash, Sparkles, Wallet, Grid3X3 } from "lucide-react";
import OccupyBadge from "../../components/common/OccupyBadge";

/* --- ผังสถานะห้อง (3 แถว × 4 คอลัมน์) --- */
function RoomStatusBoard({ rooms = [], myRoomId, onReserve }) {
  const PAGE_SIZE = 12; // 3 × 4
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(rooms.length / PAGE_SIZE));
  const pageSafe = Math.min(Math.max(page, 1), totalPages);

  const pageRooms = useMemo(() => {
    const start = (pageSafe - 1) * PAGE_SIZE;
    return rooms.slice(start, start + PAGE_SIZE);
  }, [rooms, pageSafe]);

  useEffect(() => {
    if (page !== pageSafe) setPage(pageSafe);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rooms.length, totalPages]);

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Grid3X3 className="w-5 h-5 text-purple-600" />
          <h3 className="text-2xl font-semibold text-slate-800">สถานะห้องพักทั้งหมด</h3>
        </div>

        {/* ปุ่มเปลี่ยนหน้า (โทนเดียวกับระบบ) */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={pageSafe === 1}
            className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50"
          >
            ก่อนหน้า
          </button>
          <span className="text-sm font-medium text-slate-700">
            หน้า <span className="tabular-nums">{pageSafe}</span> /{" "}
            <span className="tabular-nums">{totalPages}</span>
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={pageSafe === totalPages}
            className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50"
          >
            ถัดไป
          </button>
        </div>
      </div>

      {/* กริด 3×4 (การ์ดใหญ่ อ่านง่าย) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {pageRooms.map((r) => {
          const s = String(r.status || "").toLowerCase(); // available / reserved / pending / occupied
          const mine = r.room_id === myRoomId;

          // สีสถานะ: ว่าง(เขียว) / จอง(เหลือง) / มีผู้เช่า(แดง)
          const color =
            s === "occupied"
              ? "bg-rose-600"
              : s === "reserved" || s === "pending"
              ? "bg-amber-500"
              : "bg-emerald-500";

          const clickable = !myRoomId && (s === "available" || s === "vacant");

          return (
            <button
              key={r.room_id}
              type="button"
              onClick={clickable ? () => onReserve(r) : undefined}
              className={[
                "p-6 rounded-2xl text-center text-white select-none transition-all duration-150 shadow-sm",
                color,
                mine ? "ring-4 ring-offset-2 ring-purple-400" : "",
                clickable ? "hover:opacity-95 hover:shadow-lg" : "cursor-default",
              ].join(" ")}
              title={
                mine
                  ? "ห้องของฉัน"
                  : s === "occupied"
                  ? "มีผู้เช่าแล้ว"
                  : s === "reserved" || s === "pending"
                  ? "ถูกจอง"
                  : clickable
                  ? "คลิกเพื่อจอง"
                  : "ว่าง"
              }
            >
              <div className="text-2xl font-extrabold tracking-wide">ห้อง {r.room_number}</div>
              <div className="text-sm opacity-95 mt-1 font-medium">
                {mine
                  ? "ห้องของฉัน"
                  : s === "occupied"
                  ? "มีผู้เช่าแล้ว"
                  : s === "reserved" || s === "pending"
                  ? "ถูกจอง"
                  : "ว่าง"}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default function RoomInfoPage() {
  const [rooms, setRooms] = useState([]); // ห้องของฉัน (0 หรือ 1)
  const [board, setBoard] = useState([]); // ผังห้องทั้งหมด
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const me = (() => {
    try {
      return JSON.parse(localStorage.getItem("auth_user") || "{}");
    } catch {
      return {};
    }
  })();
  const myUserId = me?.id || null;

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const [mine, all] = await Promise.all([roomApi.getMine(), roomApi.listBoard()]);
        setRooms(Array.isArray(mine) ? mine : []);
        setBoard(Array.isArray(all) ? all : []);
      } catch (e) {
        const api = e?.response?.data;
        setErr(api?.error || api?.message || "โหลดข้อมูลไม่สำเร็จ");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const myRoomId = rooms?.[0]?.room_id || null;
  const canReserveNow = !myRoomId;

  const handleReserve = async (room) => {
    if (!canReserveNow) return;
    const s = String(room?.status || "").toLowerCase();
    if (!(s === "available" || s === "vacant")) return;

    if (!window.confirm(`ยืนยันจองห้อง ${room.room_number}?`)) return;
    try {
      await roomApi.reserve(room.room_id);
      setBoard((prev) =>
        prev.map((it) => (it.room_id === room.room_id ? { ...it, status: "reserved" } : it))
      );
      alert("ส่งคำขอจองเรียบร้อย (รอแอดมินอนุมัติ)");
    } catch (e) {
      const api = e?.response?.data;
      alert(api?.error || api?.message || "จองห้องไม่สำเร็จ");
    }
  };

  const myRoom = rooms?.[0] || null;

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gradient-to-b from-white to-slate-50">
      <div className="max-w-6xl mx-auto px-6 sm:px-8 py-10">
        {/* Hero (ให้โทนเดียวกับหน้าชำระเงิน) */}
        <div className="rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-7 shadow-lg mb-6">
          <div className="flex items-start gap-4">
            <div className="bg-white/15 rounded-xl p-2.5">
              <Home className="w-7 h-7" />
            </div>
            <div className="flex-1">
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">ข้อมูลห้องพัก</h1>
              <p className="text-white/80 text-sm sm:text-base mt-1">
                แสดงห้องของบัญชี และผังห้องทั้งหมด
              </p>
            </div>
            {/* สรุปราคา/ห้องฉัน (ถ้ามี) */}
            {myRoom && (
              <div className="ml-auto text-right">
                <div className="text-xs sm:text-sm text-white/80">ห้องของฉัน</div>
                <div className="text-2xl sm:text-3xl font-black">
                  {myRoom.room_number}
                </div>
                <div className="text-white/80 text-sm sm:text-base">
                  {myRoom.price != null ? Number(myRoom.price).toLocaleString() : "-"} บาท/เดือน
                </div>
              </div>
            )}
          </div>
        </div>

        <section className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-6 sm:p-8">
          {/* โหลด/เออเรอร์ */}
          {loading && <div className="text-base text-slate-500">กำลังโหลดข้อมูล…</div>}
          {!loading && err && <div className="text-base text-rose-600">{err}</div>}

          {/* ห้องของฉัน */}
          {!loading && !err && rooms.length > 0 && (
            <div className="divide-y divide-slate-200">
              {rooms.map((r) => (
                <article key={r.room_id} className="py-6 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center flex-wrap gap-3">
                      <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-lg font-semibold bg-purple-100 text-purple-700">
                        <Home className="w-5 h-5" />
                        ห้อง {r.room_number}
                      </span>
                      <span className="inline-flex items-center gap-2 text-slate-400 text-lg">
                        <Hash className="w-5 h-5" />
                        รหัส {r.room_id}
                      </span>
                    </div>

                    {/* ป้ายสถานะ */}
                    <OccupyBadge room={r} myUserId={myUserId} />
                  </div>

                  <dl className="mt-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:gap-5">
                      <dt className="text-lg text-slate-600 min-w-[170px] inline-flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-purple-600" />
                        สิ่งอำนวยความสะดวก
                      </dt>
                      <dd className="text-xl text-slate-900">
                        {[r.has_fan && "พัดลม", r.has_aircon && "แอร์", r.has_fridge && "ตู้เย็น"]
                          .filter(Boolean)
                          .join(" · ") || "-"}
                      </dd>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center sm:gap-5">
                      <dt className="text-lg text-slate-600 min-w-[170px] inline-flex items-center gap-2">
                        <Wallet className="w-5 h-5 text-purple-600" />
                        ราคา / เดือน
                      </dt>
                      <dd className="text-2xl font-bold text-slate-900">
                        {r.price != null ? Number(r.price).toLocaleString() : "-"} บาท
                      </dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          )}

          {/* ผังห้องทั้งหมด */}
          {!loading && !err && (
            <RoomStatusBoard rooms={board} myRoomId={myRoomId} onReserve={handleReserve} />
          )}
        </section>
      </div>
    </div>
  );
}
