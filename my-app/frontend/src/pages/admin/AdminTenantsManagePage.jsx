// src/pages/admin/AdminTenantsManagePage.jsx
import React, { useEffect, useState } from "react";
import { tenantApi } from "../../services/tenant.api";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:3000/api";
const TOKEN_KEY = process.env.REACT_APP_TOKEN_KEY || "dm_token";

const formatDate = (s) => (s ? String(s).slice(0, 10) : "-");

export default function AdminTenantsManagePage() {
  /* ===================== state หลัก ===================== */
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  /* ====== สำหรับสร้าง ====== */
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    phone: "",
    room_id: "",
    checkin_date: "",
  });

  /* ====== สำหรับแก้ไข inline ====== */
  const [editing, setEditing] = useState(null); // เก็บแถวที่กำลังแก้ไข (ต้องมี tenant_id)
  const [editForm, setEditForm] = useState({
    name: "",
    phone: "",
    room_id: "",
    checkin_date: "",
  });

  /* ===================== โหลดข้อมูล ===================== */
  const load = async (query = "") => {
    setLoading(true);
    setErr("");
    try {
      // GET /api/admin/tenants?q=...
      const data = await tenantApi.list(query);
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      let msg = e.message || "ดึงข้อมูลไม่สำเร็จ";
      if (e.status === 401) msg = "ไม่ได้รับอนุญาต (401) — โปรดเข้าสู่ระบบผู้ดูแล";
      if (e.status === 403) msg = "สิทธิ์ไม่พอ (403) — ต้องเป็นแอดมิน";
      if (e.status === 404) msg = "ไม่พบปลายทาง API (404) — ตรวจ path/เมานต์ route";
      setErr(`${msg}${e.code ? ` [${e.code}]` : ""}`);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // debounce ค้นหา 300ms
  useEffect(() => {
    const t = setTimeout(() => load(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const onManualSearch = () => load(q);
  const onClear = () => { setQ(""); load(""); };

  /* ===================== สร้างผู้เช่า ===================== */
  const onCreate = async (e) => {
    e.preventDefault();
    try {
      await tenantApi.create({
        name: createForm.name.trim(),
        phone: createForm.phone.trim() || null,
        // room_id ไม่บังคับ — ส่ง "" ได้ (backend จะบันทึกเป็น NULL)
        room_id: (createForm.room_id ?? "").trim(),
        checkin_date: createForm.checkin_date || null,
      });
      setShowCreate(false);
      setCreateForm({ name: "", phone: "", room_id: "", checkin_date: "" });
      await load(q);
    } catch (e2) {
      alert(e2?.response?.data?.error || e2.message || "บันทึกไม่สำเร็จ");
    }
  };

  /* ===================== แก้ไขผู้เช่า ===================== */
  const startEdit = (r) => {
    if (!r.tenant_id) {
      alert("ยังไม่มีรหัสผู้เช่า (tenant) — โปรดผูกห้องก่อน");
      return;
    }
    setEditing(r); // เก็บทั้ง record (ต้องมี tenant_id)
    setEditForm({
      name: r.name || "",
      phone: r.phone || "",
      room_id: r.room_id || "",
      checkin_date: formatDate(r.checkin_date) || "",
    });
  };

  const saveEdit = async () => {
    if (!editing) return;
    try {
      await tenantApi.update(editing.tenant_id, {
        name: editForm.name.trim(),
        phone: editForm.phone.trim() || null,
        // room_id: '' => null (ยกเลิกการผูกห้อง)
        room_id: editForm.room_id === "" ? null : editForm.room_id,
        checkin_date: editForm.checkin_date || null,
      });
      setEditing(null);
      await load(q);
    } catch (e) {
      alert(e?.response?.data?.error || e.message || "อัปเดตไม่สำเร็จ");
    }
  };

  /* ===================== ลบผู้เช่า (soft delete) ===================== */
  const onDelete = async (r) => {
    if (!r.tenant_id) {
      alert("แถวนี้ยังไม่มีรหัสผู้เช่า (tenant) ให้ลบ");
      return;
    }
    if (!window.confirm("คุณแน่ใจหรือไม่ว่าจะลบผู้ใช้นี้ออกจากระบบ")) return;
    try {
      await tenantApi.remove(r.tenant_id); // DELETE /api/admin/tenants/:tenantId
      await load(q);
    } catch (e) {
      alert(e?.response?.data?.error || e.message || "ลบไม่สำเร็จ");
    }
  };

  /* ===================== ผูกห้อง (สำหรับ user ที่ยังไม่มี tenant) ===================== */
  const quickBook = async (r) => {
    const roomId = window.prompt("กรอก Room ID ที่ต้องการผูกให้ผู้ใช้ (เช่น A101):", "");
    if (!roomId) return;
    const checkin = window.prompt("วันที่เข้าพัก (YYYY-MM-DD) หรือเว้นว่าง:", "");
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const resp = await fetch(`${API_BASE}/admin/rooms/${encodeURIComponent(roomId.trim())}/book`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ userId: r.user_id, checkin_date: checkin || undefined }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || "ผูกห้องไม่สำเร็จ");
      alert("ผูกห้องสำเร็จ");
      await load(q);
    } catch (e) {
      alert(e.message || "ผูกห้องไม่สำเร็จ");
    }
  };

  /* ===================== UI ===================== */
  return (
    <div>
      {/* Header */}
      <div className="ad-header">
        <h2 style={{ margin: 0 }}>จัดการผู้เช่า</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            className="input"
            placeholder="ค้นหา: User ID (เช่น 107) / รหัสผู้เช่า (T0001) / ชื่อ / เบอร์"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button className="btn btn-outline" onClick={onManualSearch}>ค้นหา</button>
          <button className="btn btn-outline" onClick={onClear}>ล้าง</button>

          
        </div>
      </div>

      {/* ฟอร์มสร้างผู้เช่า */}
      {showCreate && (
        <div className="ad-panel" style={{ marginTop: 12 }}>
          <form onSubmit={onCreate}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 8 }}>
              <div>
                <label className="label">ชื่อผู้เช่า*</label>
                <input
                  className="input"
                  required
                  value={createForm.name}
                  onChange={(e) => setCreateForm(p => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">เบอร์โทรศัพท์</label>
                <input
                  className="input"
                  value={createForm.phone}
                  onChange={(e) => setCreateForm(p => ({ ...p, phone: e.target.value }))}
                />
              </div>
              <div>
                {/* ไม่บังคับ room_id แล้ว */}
                <label className="label">ไอดีห้อง</label>
                <input
                  className="input"
                  value={createForm.room_id}
                  onChange={(e) => setCreateForm(p => ({ ...p, room_id: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">วันที่เข้าพัก</label>
                <input
                  className="input"
                  type="date"
                  value={createForm.checkin_date}
                  onChange={(e) => setCreateForm(p => ({ ...p, checkin_date: e.target.value }))}
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button type="button" className="btn" onClick={() => setShowCreate(false)}>ยกเลิก</button>
              <button className="btn btn-primary">บันทึก</button>
            </div>
          </form>
        </div>
      )}

      {/* ตาราง */}
      <div className="ad-panel" style={{ marginTop: 12 }}>
        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>User ID</th>
                
                <th>ชื่อผู้เช่า</th>
                <th>ไอดีห้อง</th>
                <th>เบอร์โทรศัพท์</th>
                <th>วันที่เข้าพัก</th>
                <th style={{ minWidth: 220 }}>การจัดการ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="8">กำลังโหลด...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan="8">{err ? "เกิดข้อผิดพลาดหรือไม่พบข้อมูล" : "ไม่พบข้อมูล"}</td></tr>
              ) : (
                rows.map((r, idx) => {
                  const isEdit = editing?.tenant_id === r.tenant_id;
                  const canManageTenant = !!r.tenant_id;
                  return (
                    <React.Fragment key={r.user_id}>
                      <tr>
                        <td>{idx + 1}</td>
                        <td><strong>{r.user_id}</strong></td>
                       
                        <td>{r.name}</td>
                        <td>{r.room_id || <em>ยังไม่ผูก</em>}</td>
                        <td>{r.phone || "-"}</td>
                        <td>{formatDate(r.checkin_date)}</td>
                        <td style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {canManageTenant ? (
                            <>
                              <button className="btn btn-warning" onClick={() => startEdit(r)}>แก้ไข</button>
                              <button className="btn btn-danger" onClick={() => onDelete(r)}>ลบ</button>
                            </>
                          ) : (
                            <button className="btn btn-primary" onClick={() => quickBook(r)}>ผูกห้อง</button>
                          )}
                        </td>
                      </tr>

                      {isEdit && (
                        <tr>
                          <td colSpan="8">
                            <div className="ad-panel" style={{ marginTop: 10 }}>
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 8 }}>
                                <div>
                                  <label className="label">ชื่อผู้เช่า</label>
                                  <input
                                    className="input"
                                    value={editForm.name}
                                    onChange={(e) => setEditForm(p => ({ ...p, name: e.target.value }))}
                                  />
                                </div>
                                <div>
                                  <label className="label">เบอร์โทรศัพท์</label>
                                  <input
                                    className="input"
                                    value={editForm.phone}
                                    onChange={(e) => setEditForm(p => ({ ...p, phone: e.target.value }))}
                                  />
                                </div>
                                <div>
                                  <label className="label">ไอดีห้อง</label>
                                  <input
                                    className="input"
                                    value={editForm.room_id}
                                    onChange={(e) => setEditForm(p => ({ ...p, room_id: e.target.value }))}
                                  />
                                </div>
                                <div>
                                  <label className="label">วันที่เข้าพัก</label>
                                  <input
                                    className="input"
                                    type="date"
                                    value={editForm.checkin_date}
                                    onChange={(e) => setEditForm(p => ({ ...p, checkin_date: e.target.value }))}
                                  />
                                </div>
                              </div>
                              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                                <button className="btn" onClick={() => setEditing(null)}>ยกเลิก</button>
                                <button className="btn btn-primary" onClick={saveEdit}>บันทึก</button>
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

        {err && (
          <div className="ad-panel" style={{ marginTop: 12, background: "#ffecec", borderColor: "#f5a5a5" }}>
            {err}
          </div>
        )}
      </div>
    </div>
  );
}
