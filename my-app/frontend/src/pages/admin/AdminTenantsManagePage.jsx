// src/pages/admin/AdminTenantsManagePage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Search, Filter, Edit2, Trash2, User, Users } from "lucide-react";
import { tenantApi } from "../../services/tenant.api";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:3000/api";
const TOKEN_KEY = process.env.REACT_APP_TOKEN_KEY || "dm_token";

const PAGE_SIZE = 10;
const formatDate = (s) => (s ? String(s).slice(0, 10) : "-");

export default function AdminTenantsManagePage() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  /* inline edit */
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({
    name: "", phone: "", room_id: "", checkin_date: ""
  });

  /* modal: ผูกห้อง (เฉพาะ user ที่ยังไม่มี tenant_id) */
  const [bookForUser, setBookForUser] = useState(null); // { user_id, name }
  const [bookForm, setBookForm] = useState({ room_id: "", checkin_date: "" });

  /* pagination */
  const [page, setPage] = useState(1);

  /* ------- load ------- */
  const load = async (query = "") => {
    setLoading(true);
    setErr("");
    try {
      const data = await tenantApi.list(query); // GET /api/admin/tenants?q=
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(e?.response?.data?.error || e.message || "โหลดข้อมูลไม่สำเร็จ");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); load(q); }, 300);
    return () => clearTimeout(t);
  }, [q]);

  /* ------- actions ------- */
  const startEdit = (r) => {
    if (!r.tenant_id) {
      alert("ผู้ใช้นี้ยังไม่มี tenant_id — โปรดผูกห้องก่อนจึงจะแก้ไขได้");
      return;
    }
    setEditing(r);
    setEditForm({
      name: r.name || "",
      phone: r.phone || "",
      room_id: r.room_id || "",
      checkin_date: formatDate(r.checkin_date) || ""
    });
  };

  const saveEdit = async () => {
    if (!editing) return;
    try {
      await tenantApi.update(editing.tenant_id, {
        name: editForm.name.trim(),
        phone: editForm.phone.trim() || null,
        room_id: editForm.room_id === "" ? null : editForm.room_id,
        checkin_date: editForm.checkin_date || null,
      });
      setEditing(null);
      await load(q);
    } catch (e) {
      alert(e?.response?.data?.error || e.message || "อัปเดตไม่สำเร็จ");
    }
  };

  const onDelete = async (r) => {
    if (!r.tenant_id) {
      alert("ยังไม่มี tenant_id ให้ลบ");
      return;
    }
    if (!window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบผู้เช่า : ${r.name || r.user_id} ?`)) return;
    try {
      await tenantApi.remove(r.tenant_id); // DELETE /api/admin/tenants/:tenantId
      await load(q);
    } catch (e) {
      alert(e?.response?.data?.error || e.message || "ลบไม่สำเร็จ");
    }
  };

  const openBookModal = (r) => {
    setBookForUser({ user_id: r.user_id, name: r.name || `User#${r.user_id}` });
    setBookForm({ room_id: "", checkin_date: "" });
  };

  const submitBook = async (e) => {
    e?.preventDefault?.();
    if (!bookForUser || !bookForm.room_id) return;
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const resp = await fetch(
        `${API_BASE}/rooms/${encodeURIComponent(bookForm.room_id)}/book`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            userId: bookForUser.user_id,
            checkin_date: bookForm.checkin_date || undefined,
          }),
          credentials: "include",
        }
      );
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.error || "ผูกห้องไม่สำเร็จ");
      setBookForUser(null);
      await load(q);
      alert("ผูกห้องสำเร็จ");
    } catch (e) {
      alert(e.message || "ผูกห้องไม่สำเร็จ");
    }
  };

  /* ------- derive & pagination ------- */
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      (r.name || "").toLowerCase().includes(s) ||
      (r.phone || "").includes(s) ||
      (r.room_id || "").toLowerCase().includes(s) ||
      String(r.user_id).includes(s) ||
      (r.tenant_id || "").toLowerCase().includes(s)
    );
  }, [rows, q]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const startIndex = (page - 1) * PAGE_SIZE;
  const pagedRows = filtered.slice(startIndex, startIndex + PAGE_SIZE);

  const gotoPage = (p) => {
    if (p < 1 || p > totalPages) return;
    setPage(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /* ---------------- UI ---------------- */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-indigo-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800">จัดการผู้เช่า</h2>
            </div>
            <p className="text-slate-600 text-sm">
              จัดการข้อมูลผู้เช่า / ผูกห้อง / แก้ไขข้อมูลพื้นฐาน
            </p>
          </div>
        </div>

        {/* Search bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 pointer-events-none" />
            <input
              type="text"
              placeholder="ค้นหา: ชื่อ, เบอร์โทร, room_id, user_id, tenant_id"
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg 
                         focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                         text-sm bg-white"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          {/* ปุ่มกรอง — โทนเดียวกับ “สร้างห้อง” */}
          <button
            type="button"
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
              {/* หัวตาราง “ฟ้าม่วงทึบ” เหมือนหน้า “จัดการห้อง” */}
              <tr className="sticky top-0 z-10 bg-indigo-700 border-b border-indigo-800">
                <th className="px-6 py-4 text-left text-sm font-semibold text-white">ลำดับ</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-white">User ID</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-white">ผู้เช่า</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-white">room_id</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-white">เบอร์โทร</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-white">เช็คอิน</th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-white">จัดการ</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center p-6 text-slate-500">กำลังโหลดข้อมูล...</td>
                </tr>
              ) : pagedRows.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center p-6 text-slate-500">
                    {err || "ไม่พบข้อมูลผู้เช่า"}
                  </td>
                </tr>
              ) : (
                pagedRows.map((r, i) => {
                  const noTenant = !r.tenant_id;
                  const isEditing = editing?.user_id === r.user_id;
                  return (
                    <React.Fragment key={r.user_id}>
                      <tr className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 text-slate-600 text-sm">{startIndex + i + 1}</td>
                        <td className="px-6 py-4 font-medium">{r.user_id}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-slate-700">
                            <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center">
                              <User className="w-4 h-4 text-slate-500" />
                            </div>
                            <div className="min-w-0">
                              <div className="truncate">{r.name || <em className="text-slate-400">ไม่ระบุชื่อ</em>}</div>
                              <div className="text-xs text-slate-400">{r.tenant_id || "—"}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-700">
                          {r.room_id || <span className="text-slate-400 italic">ยังไม่ผูก</span>}
                        </td>
                        <td className="px-6 py-4 text-slate-700">{r.phone || "-"}</td>
                        <td className="px-6 py-4 text-slate-700">{formatDate(r.checkin_date)}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2">
                            {noTenant ? (
                              <button
                                className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                                onClick={() => openBookModal(r)}
                                title="ผูกห้องให้ผู้ใช้"
                              >
                                ผูกห้อง
                              </button>
                            ) : (
                              <>
                                <button
                                  onClick={() => startEdit(r)}
                                  className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                  title="แก้ไข"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => onDelete(r)}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="ลบ"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* แถวแก้ไข */}
                      {isEditing && (
                        <tr>
                          <td colSpan="7" className="bg-slate-50">
                            <div className="p-4">
                              <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))" }}>
                                <div>
                                  <label className="block text-sm text-slate-600 mb-1">ชื่อผู้เช่า</label>
                                  <input
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                    value={editForm.name}
                                    onChange={(e) => setEditForm(p => ({ ...p, name: e.target.value }))}
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm text-slate-600 mb-1">เบอร์โทร</label>
                                  <input
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                    value={editForm.phone}
                                    onChange={(e) => setEditForm(p => ({ ...p, phone: e.target.value }))}
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm text-slate-600 mb-1">room_id</label>
                                  <input
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                    placeholder="เว้นว่างเพื่อยกเลิกการผูก"
                                    value={editForm.room_id}
                                    onChange={(e) => setEditForm(p => ({ ...p, room_id: e.target.value }))}
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm text-slate-600 mb-1">วันที่เช็คอิน</label>
                                  <input
                                    type="date"
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                    value={editForm.checkin_date}
                                    onChange={(e) => setEditForm(p => ({ ...p, checkin_date: e.target.value }))}
                                  />
                                </div>
                              </div>
                              <div className="flex justify-end gap-2 mt-3">
                                <button
                                  className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-white transition"
                                  onClick={() => setEditing(null)}
                                >
                                  ยกเลิก
                                </button>
                                <button
                                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                                  onClick={saveEdit}
                                >
                                  บันทึก
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination — เหมือนหน้า “จัดการห้อง” */}
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

            {/* ปุ่มเลขหน้าปัจจุบัน — สีเดียวกับหัวตาราง */}
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

      {/* Modal: ผูกห้อง */}
      {bookForUser && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
          onClick={() => setBookForUser(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-slate-800 mb-2">ผูกห้องให้ผู้ใช้</h3>
            <p className="text-slate-600 text-sm mb-4">
              ผู้ใช้: <span className="font-semibold">{bookForUser.name}</span> (ID: {bookForUser.user_id})
            </p>
            <form onSubmit={submitBook} className="space-y-3">
              <div>
                <label className="block text-sm text-slate-600 mb-1">room_id (เช่น A101)</label>
                <input
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  value={bookForm.room_id}
                  onChange={(e) => setBookForm(p => ({ ...p, room_id: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">วันที่เช็คอิน</label>
                <input
                  type="date"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  value={bookForm.checkin_date}
                  onChange={(e) => setBookForm(p => ({ ...p, checkin_date: e.target.value }))}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-white transition"
                  onClick={() => setBookForUser(null)}
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                >
                  ผูกห้อง
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
