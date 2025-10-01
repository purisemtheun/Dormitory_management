import React, { useEffect, useState } from "react";
import { tenantApi } from "../../services/tenant.api";


const formatDate = (s) => (s ? String(s).slice(0, 10) : "-");

export default function AdminTenantsManagePage() {
  // ===== state หลัก (เดิม) =====
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // 🟢 NEW: state สำหรับสร้าง & แก้ไข
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    phone: "",
    room_id: "",
    checkin_date: "",
  });

  const [editing, setEditing] = useState(null); // เก็บเรคคอร์ดที่กำลังแก้ไข
  const [editForm, setEditForm] = useState({
    name: "",
    phone: "",
    room_id: "",
    checkin_date: "",
  });

  // ===== โหลดข้อมูล (เดิม) =====
  const load = async (query = "") => {
    setLoading(true);
    setErr("");
    try {
      const data = await tenantApi.list(query); // GET /api/admin/tenants?q=...
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

  // debounce ค้นหา 300ms (เดิม)
  useEffect(() => {
    const t = setTimeout(() => load(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const onManualSearch = () => load(q);
  const onClear = () => { setQ(""); load(""); };

  // 🟢 NEW: สร้างผู้เช่า
  const onCreate = async (e) => {
    e.preventDefault();
    try {
      // คาดหวัง backend: POST /tenants  ต้องรับ { name, phone, room_id, checkin_date }
      await tenantApi.create({
        name: createForm.name.trim(),
        phone: createForm.phone.trim() || null,
        room_id: createForm.room_id.trim(),
        checkin_date: createForm.checkin_date || null,
      });
      setShowCreate(false);
      setCreateForm({ name: "", phone: "", room_id: "", checkin_date: "" });
      await load(q);
    } catch (e2) {
      alert(e2.message || "บันทึกไม่สำเร็จ");
    }
  };

  // 🟢 NEW: เริ่มแก้ไข (เปิด editor แถวล่างตาราง)
  const startEdit = (r) => {
    setEditing(r); // เก็บทั้งแถว
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
      room_id: editForm.room_id === "" ? null : editForm.room_id,
      checkin_date: editForm.checkin_date || null,
    });
    setEditing(null); // ปิด editor
    await load(q);    // โหลดใหม่
  } catch (e) {
    alert(e?.response?.data?.error || e.message);
  }
};


  // 🟢 NEW: ลบผู้เช่า
  const onDelete = async (r) => {
    if (!window.confirm(`ลบผู้เช่า ${r.tenant_code || r.tenant_id}?`)) return;
    try {
      await tenantApi.remove(r.tenant_id);
      await load(q);
    } catch (e) {
      alert(e.message || "ลบไม่สำเร็จ");
    }
  };

  return (
    <div>
      {/* Header (เดิม) */}
      <div className="ad-header">
        <h2 style={{ margin: 0 }}>จัดการผู้เช่า</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            className="input"
            placeholder="ค้นหา: รหัสผู้เช่า (เช่น T0001) หรือ ชื่อผู้เช่า"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button className="btn btn-outline" onClick={onManualSearch}>ค้นหา</button>
          <button className="btn btn-outline" onClick={onClear}>ล้าง</button>

          {/* 🟢 NEW: ปุ่มเปิด/ปิดฟอร์มสร้าง */}
          <button className="btn btn-primary" onClick={() => setShowCreate(v => !v)}>
            {showCreate ? "ปิดฟอร์ม" : "เพิ่มผู้เช่า"}
          </button>
        </div>
      </div>

      {/* 🟢 NEW: ฟอร์มสร้างผู้เช่า */}
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
                <label className="label">ไอดีห้อง*</label>
                <input
                  className="input"
                  required
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

      {/* Table (เดิม + แก้ไข inline) */}
      <div className="ad-panel" style={{ marginTop: 12 }}>
        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>ID ผู้เช่า</th>
                <th>ชื่อผู้เช่า</th>
                <th>ไอดีห้อง</th>
                <th>เบอร์โทรศัพท์</th>
                <th>วันที่เข้าพัก</th>
                <th style={{ minWidth: 180 }}>การจัดการ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7">กำลังโหลด...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan="7">{err ? "เกิดข้อผิดพลาดหรือไม่พบข้อมูล" : "ไม่พบข้อมูล"}</td></tr>
              ) : (
                rows.map((r, idx) => {
                  const isEdit = editing?.tenant_id === r.tenant_id;
                  return (
                    <React.Fragment key={r.tenant_code || r.tenant_id}>
                      <tr>
                        <td>{idx + 1}</td>
                        <td>{r.tenant_code || r.tenant_id}</td>
                        <td>{r.name}</td>
                        <td>{r.room_id}</td>
                        <td>{r.phone || "-"}</td>
                        <td>{formatDate(r.checkin_date)}</td>
                        <td style={{ display: "flex", gap: 8 }}>
                          <button className="btn btn-warning" onClick={() => startEdit(r)}>แก้ไข</button>
                          <button className="btn btn-danger" onClick={() => onDelete(r)}>ลบ</button>
                        </td>
                      </tr>

                      {/* 🟢 NEW: แถวแก้ไข inline */}
                      {isEdit && (
                        <tr>
                          <td colSpan="7">
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
