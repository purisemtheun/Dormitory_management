// src/pages/admin/AdminRoomManagePage.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Search, Filter, Plus, Edit2, Trash2, Eye, Home,
  CheckCircle, User, Link2, Clock
} from "lucide-react";
import { roomApi } from "../../api/room.api.js";

const PAGE_SIZE = 5;

export default function AdminRoomManagePage() {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");

  // ====== สร้างห้อง ======
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    room_id: "",
    room_number: "",
    price: "",
    has_fan: false,
    has_aircon: false,
    has_fridge: false,
  });
  const [createBusy, setCreateBusy] = useState(false);

  // ====== ผูกผู้เช่า ======
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [linkForm, setLinkForm] = useState({ userId: "", checkin_date: "" });
  const [busy, setBusy] = useState(false);

  // โหลดข้อมูล
  const loadRooms = async () => {
    try {
      setLoading(true);
      const data = await roomApi.list();
      setRooms(data || []);
    } catch (err) {
      console.error("loadRooms error:", err);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { loadRooms(); }, []);

  // กรอง + แบ่งหน้า
  const filtered = useMemo(() => {
    const q = (searchTerm || "").toLowerCase();
    return rooms.filter((r) => {
      const id = String(r.room_id ?? "").toLowerCase();
      const number = String(r.room_number ?? "").toLowerCase();
      const status = String(r.status ?? "").toLowerCase();
      return id.includes(q) || number.includes(q) || status.includes(q);
    });
  }, [rooms, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const startIndex = (page - 1) * PAGE_SIZE;
  const pagedRooms = filtered.slice(startIndex, startIndex + PAGE_SIZE);

  const gotoPage = (p) => {
    if (p < 1 || p > totalPages) return;
    setPage(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ====== ป้ายสถานะ ======
  const getStatusBadge = (statusRaw) => {
    const status = String(statusRaw || "").toLowerCase();
    if (status === "reserved" || status === "pending") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
          <Clock className="w-3.5 h-3.5" />
          ถูกจอง
        </span>
      );
    }
    if (status === "available" || status === "vacant") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
          <CheckCircle className="w-3.5 h-3.5" />
          ว่าง
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-sky-100 text-sky-700">
        <User className="w-3.5 h-3.5" />
        มีผู้เช่า
      </span>
    );
  };

  // ====== Link tenant ======
  const openLinkModal = (r) => {
    setSelectedRoom(r);
    setLinkForm({
      userId: "",
      checkin_date: new Date().toISOString().slice(0, 10),
    });
    setShowLinkModal(true);
  };

  const submitLinkTenant = async (e) => {
    e.preventDefault();
    if (!linkForm.userId) {
      alert("กรุณากรอก userId");
      return;
    }
    setBusy(true);
    try {
      await roomApi.bookForTenant(selectedRoom.room_id, {
        userId: linkForm.userId,
        checkin_date: linkForm.checkin_date,
      });
      alert("✅ ผูกผู้เช่าสำเร็จ");
      setShowLinkModal(false);
      loadRooms();
    } catch (err) {
      alert(err?.response?.data?.error || err.message);
    } finally {
      setBusy(false);
    }
  };

  // ====== Create room ======
  const openCreate = () => {
    setCreateForm({
      room_id: "",
      room_number: "",
      price: "",
      has_fan: false,
      has_aircon: false,
      has_fridge: false,
    });
    setShowCreateModal(true);
  };

  const submitCreateRoom = async (e) => {
    e.preventDefault();
    if (!createForm.room_id || !createForm.room_number) {
      alert("กรุณากรอก รหัสห้อง และ เลขห้อง");
      return;
    }
    setCreateBusy(true);
    try {
      await roomApi.create({
        room_id: createForm.room_id.trim(),
        room_number: createForm.room_number.trim(),
        price: createForm.price === "" ? null : Number(createForm.price),
        status: "available",
        has_fan: !!createForm.has_fan,
        has_aircon: !!createForm.has_aircon,
        has_fridge: !!createForm.has_fridge,
      });
      setShowCreateModal(false);
      await loadRooms();
    } catch (err) {
      alert(err?.response?.data?.error || err.message);
    } finally {
      setCreateBusy(false);
    }
  };

  // ====== ตัวเลขสถิติ ======
  const total = rooms.length;
  const availableCount = rooms.filter(r => {
    const s = String(r.status || "").toLowerCase();
    return s === "available" || s === "vacant";
  }).length;
  const reservedCount = rooms.filter(r => {
    const s = String(r.status || "").toLowerCase();
    return s === "reserved" || s === "pending";
  }).length;
  const occupiedCount = rooms.filter(r => String(r.status || "").toLowerCase() === "occupied").length;

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                <Home className="w-6 h-6 text-indigo-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800">จัดการห้องพัก</h2>
            </div>
            <p className="text-slate-600 text-sm">จัดการข้อมูลห้องพักและสถานะการเช่า</p>
          </div>
          <button
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 
                       text-white rounded-lg hover:from-indigo-700 hover:to-indigo-800 
                       transition-all duration-200 shadow-lg shadow-indigo-200 font-medium"
            onClick={openCreate}
          >
            <Plus className="w-5 h-5" />
            สร้างห้อง
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-xl p-4 border border-indigo-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-indigo-600 font-medium">ห้องทั้งหมด</p>
                <p className="text-3xl font-bold text-indigo-900 mt-1">{total}</p>
              </div>
              <div className="w-12 h-12 bg-indigo-500 rounded-lg flex items-center justify-center shadow-lg">
                <Home className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-4 border border-emerald-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-emerald-600 font-medium">ห้องว่าง</p>
                <p className="text-3xl font-bold text-emerald-900 mt-1">{availableCount}</p>
              </div>
              <div className="w-12 h-12 bg-emerald-500 rounded-lg flex items-center justify-center shadow-lg">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>

          {/* ✅ การ์ด “ห้องถูกจอง” สีเหลือง */}
          <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-4 border border-amber-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-amber-600 font-medium">ห้องถูกจอง</p>
                <p className="text-3xl font-bold text-amber-900 mt-1">{reservedCount}</p>
              </div>
              <div className="w-12 h-12 bg-amber-500 rounded-lg flex items-center justify-center shadow-lg">
                <Clock className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-sky-50 to-sky-100 rounded-xl p-4 border border-sky-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-sky-600 font-medium">มีผู้เช่า</p>
                <p className="text-3xl font-bold text-sky-900 mt-1">{occupiedCount}</p>
              </div>
              <div className="w-12 h-12 bg-sky-500 rounded-lg flex items-center justify-center shadow-lg">
                <User className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 pointer-events-none" />
            <input
              type="text"
              placeholder="ค้นหาห้อง, ผู้เช่า..."
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg 
                         focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                         text-sm bg-white"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
            />
          </div>

          <button
            className="flex items-center justify-center gap-2 px-5 py-2.5
                       bg-gradient-to-r from-indigo-600 to-indigo-700 text-white
                       rounded-lg hover:from-indigo-700 hover:to-indigo-800
                       transition-all duration-200 shadow-lg shadow-indigo-200 font-medium"
          >
            <Filter className="w-4 h-4" />
            กรอง
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="sticky top-0 z-10 bg-indigo-700 border-b border-indigo-800">
                <th className="px-6 py-4 text-left text-sm font-semibold text-white">ลำดับ</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-white">รหัสห้อง</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-white">เลขห้อง</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-white">ราคา</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-white">สถานะ</th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-white">จัดการ</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-10 text-center text-slate-500">กำลังโหลดข้อมูล...</td></tr>
              ) : pagedRooms.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-10 text-center text-slate-500">ไม่พบข้อมูล</td></tr>
              ) : (
                pagedRooms.map((r, i) => (
                  <tr key={r.room_id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-slate-600 text-sm">{startIndex + i + 1}</td>
                    <td className="px-6 py-4 font-medium">{r.room_id}</td>
                    <td className="px-6 py-4 text-slate-700">{r.room_number}</td>
                    <td className="px-6 py-4 text-slate-800">
                      {r?.price != null ? Number(r.price).toLocaleString() : "-"} บาท
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(r.status)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg" title="ดูรายละเอียด">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg" title="แก้ไข">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg"
                          onClick={() => openLinkModal(r)}
                          title="ผูกผู้เช่า"
                        >
                          <Link2 className="w-4 h-4" />
                        </button>
                        <button className="p-2 text-red-600 hover:bg-red-50 rounded-lg" title="ลบ">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-slate-600">
            หน้าที่ <span className="font-semibold">{page}</span> จาก{" "}
            <span className="font-semibold">{totalPages}</span>
          </p>
          <div className="flex items-center gap-2">
            <button
              className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors text-slate-700 font-medium disabled:opacity-50"
              disabled={page <= 1}
              onClick={() => gotoPage(page - 1)}
            >
              ก่อนหน้า
            </button>
            <button
              className="px-4 py-2 text-sm rounded-lg bg-indigo-700 text-white font-medium border border-indigo-800"
              disabled
            >
              {page}
            </button>
            <button
              className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors text-slate-700 font-medium disabled:opacity-50"
              disabled={page >= totalPages}
              onClick={() => gotoPage(page + 1)}
            >
              ถัดไป
            </button>
          </div>
        </div>
      </div>

      {/* Modal สร้างห้อง */}
      {showCreateModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 animate-in fade-in zoom-in duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-slate-800 mb-4">สร้างห้องใหม่</h3>
            <form onSubmit={submitCreateRoom} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-600 mb-1">รหัสห้อง (เช่น A101)</label>
                  <input
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    value={createForm.room_id}
                    onChange={(e) => setCreateForm(p => ({ ...p, room_id: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">เลขห้อง</label>
                  <input
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    value={createForm.room_number}
                    onChange={(e) => setCreateForm(p => ({ ...p, room_number: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">ราคา (บาท)</label>
                  <input
                    type="number"
                    min="0"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    value={createForm.price}
                    onChange={(e) => setCreateForm(p => ({ ...p, price: e.target.value }))}
                    placeholder="เช่น 3500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-6 pt-2">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={createForm.has_fan}
                    onChange={(e) => setCreateForm(p => ({ ...p, has_fan: e.target.checked }))}
                  />
                  พัดลม
                </label>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={createForm.has_aircon}
                    onChange={(e) => setCreateForm(p => ({ ...p, has_aircon: e.target.checked }))}
                  />
                  แอร์
                </label>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={createForm.has_fridge}
                    onChange={(e) => setCreateForm(p => ({ ...p, has_fridge: e.target.checked }))}
                  />
                  ตู้เย็น
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button type="button" className="px-4 py-2 border rounded-lg" onClick={() => setShowCreateModal(false)}>
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={createBusy}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
                >
                  {createBusy ? "กำลังบันทึก..." : "บันทึก"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal ผูกผู้เช่า */}
      {showLinkModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
          onClick={() => setShowLinkModal(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800">
                ผูกผู้เช่ากับห้อง {selectedRoom?.room_id}
              </h3>
              <button
                onClick={() => setShowLinkModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
            <form onSubmit={submitLinkTenant} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-600 mb-1">User ID ผู้เช่า</label>
                <input
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  value={linkForm.userId}
                  onChange={(e) => setLinkForm({ ...linkForm, userId: e.target.value })}
                  placeholder="เช่น 12"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">วันที่ Check-in</label>
                <input
                  type="date"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  value={linkForm.checkin_date}
                  onChange={(e) => setLinkForm({ ...linkForm, checkin_date: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" className="px-4 py-2 border rounded-lg" onClick={() => setShowLinkModal(false)}>
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  {busy ? "กำลังบันทึก..." : "ยืนยัน"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
