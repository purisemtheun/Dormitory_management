import React, { useEffect, useMemo, useState } from "react";
import { roomApi } from "../../services/room.api";

// helpers
const currency = (n) => (n === null || n === undefined ? "-" : Number(n).toLocaleString());
const today = () => new Date().toISOString().slice(0, 10);

// map โค้ดสถานะ ↔ ป้ายไทย
const ROOM_STATUS_LABEL = {
  vacant: "ว่าง",
  occupied: "มีผู้เช่า",
  reserved: "ถูกจอง",
};
const STATUS_OPTIONS = [
  { value: "vacant", label: "ว่าง" },
  { value: "occupied", label: "มีผู้เช่า" },
  { value: "reserved", label: "ถูกจอง" },
];

export default function AdminRoomsManagePage() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // ===== Create =====
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    room_id: "",
    room_number: "",
    price: "",
    status: "vacant", // ✅ default เป็นโค้ด
    has_fan: false,
    has_aircon: false,
    has_fridge: false,
  });

  // ===== Edit inline =====
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    room_number: "",
    price: "",
    status: "vacant", // ✅ ใช้โค้ด
    has_fan: false,
    has_aircon: false,
    has_fridge: false,
  });

  // ===== Bind tenant (userId) =====
  const [bindUserId, setBindUserId] = useState({});
  const [bindDate, setBindDate] = useState({});

  const load = async () => {
    setLoading(true); setErr("");
    try {
      const data = await roomApi.list(); // GET /api/rooms (admin only)
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(e?.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    if (!kw) return rows;
    return rows.filter((r) => {
      const label = ROOM_STATUS_LABEL[r.status] || r.status || "";
      return (
        String(r.room_id).toLowerCase().includes(kw) ||
        String(r.room_number || "").toLowerCase().includes(kw) ||
        String(r.status || "").toLowerCase().includes(kw) || // ค้นด้วยโค้ด
        label.toLowerCase().includes(kw) ||                  // หรือคำไทย
        (r.has_fan ? "fan" : "").includes(kw) ||
        (r.has_aircon ? "air" : "").includes(kw) ||
        (r.has_fridge ? "fridge" : "").includes(kw)
      );
    });
  }, [rows, q]);

  // ===== Create =====
  const onCreate = async (e) => {
    e.preventDefault();
    try {
      await roomApi.create({
        room_id: createForm.room_id.trim(),
        room_number: createForm.room_number.trim(),
        price: createForm.price || null,
        status: createForm.status || "vacant",
        has_fan: createForm.has_fan,
        has_aircon: createForm.has_aircon,
        has_fridge: createForm.has_fridge,
      }); // POST /api/rooms
      setShowCreate(false);
      setCreateForm({
        room_id: "",
        room_number: "",
        price: "",
        status: "vacant",
        has_fan: false,
        has_aircon: false,
        has_fridge: false,
      });
      await load();
    } catch (e) {
      alert(e?.response?.data?.error || e.message);
    }
  };

  // ===== Edit =====
  const startEdit = (r) => {
    setEditingId(r.room_id);
    setEditForm({
      room_number: r.room_number || "",
      price: r.price ?? "",
      status: r.status || "vacant",
      has_fan: !!r.has_fan,
      has_aircon: !!r.has_aircon,
      has_fridge: !!r.has_fridge,
    });
  };
  const saveEdit = async () => {
    try {
      await roomApi.update(editingId, {
        room_number: editForm.room_number,
        price: editForm.price,
        status: editForm.status,
        has_fan: editForm.has_fan,
        has_aircon: editForm.has_aircon,
        has_fridge: editForm.has_fridge,
      }); // PATCH /api/rooms/:id
      setEditingId(null);
      await load();
    } catch (e) {
      alert(e?.response?.data?.error || e.message);
    }
  };

  // ===== Delete =====
  const removeRoom = async (id) => {
    if (!window.confirm(`ลบห้อง ${id}?`)) return;
    try {
      await roomApi.remove(id); // DELETE /api/rooms/:id
      await load();
    } catch (e) {
      alert(e?.response?.data?.error || e.message);
    }
  };

  // ===== Bind tenant by userId =====
  const bindTenant = async (room_id) => {
    const userIdRaw = bindUserId[room_id];
    const userId = Number(userIdRaw);
    if (!userIdRaw || Number.isNaN(userId)) return alert("กรุณากรอก userId ของผู้เช่า (ตัวเลข)");
    try {
      await roomApi.bookForTenant(room_id, {
        userId,
        checkin_date: bindDate[room_id] || today(),
      }); // POST /api/rooms/:id/book
      setBindUserId((p) => ({ ...p, [room_id]: "" }));
      setBindDate((p) => ({ ...p, [room_id]: "" }));
      await load();
    } catch (e) {
      alert(e?.response?.data?.error || e.message);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="ad-header">
        <h2 style={{ margin: 0 }}>จัดการห้องพัก</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            className="input"
            placeholder="ค้นหา: room_id / เลขห้อง / สถานะ (ว่าง/มีผู้เช่า/ถูกจอง) / fan/air/fridge"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button className="btn btn-outline" onClick={load}>รีเฟรช</button>
          <button className="btn btn-primary" onClick={() => setShowCreate((v) => !v)}>
            {showCreate ? "ปิดฟอร์ม" : "สร้างห้อง"}
          </button>
        </div>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="ad-panel" style={{ marginBottom: 12 }}>
          <form onSubmit={onCreate}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 8 }}>
              <div>
                <label className="label">room_id*</label>
                <input
                  className="input"
                  required
                  value={createForm.room_id}
                  onChange={(e) => setCreateForm((p) => ({ ...p, room_id: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">เลขห้อง*</label>
                <input
                  className="input"
                  required
                  value={createForm.room_number}
                  onChange={(e) => setCreateForm((p) => ({ ...p, room_number: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">ราคา/เดือน</label>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  value={createForm.price}
                  onChange={(e) => setCreateForm((p) => ({ ...p, price: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">สถานะ</label>
                <select
                  className="input"
                  value={createForm.status}
                  onChange={(e) => setCreateForm((p) => ({ ...p, status: e.target.value }))}
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div style={{ gridColumn: "1/-1" }}>
                <label className="label">สิ่งอำนวยความสะดวก</label>
                <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <label>
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={createForm.has_fan}
                      onChange={(e) => setCreateForm((p) => ({ ...p, has_fan: e.target.checked }))}
                    />
                    <span style={{ marginLeft: 6 }}>พัดลม</span>
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={createForm.has_aircon}
                      onChange={(e) => setCreateForm((p) => ({ ...p, has_aircon: e.target.checked }))}
                    />
                    <span style={{ marginLeft: 6 }}>แอร์</span>
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={createForm.has_fridge}
                      onChange={(e) => setCreateForm((p) => ({ ...p, has_fridge: e.target.checked }))}
                    />
                    <span style={{ marginLeft: 6 }}>ตู้เย็น</span>
                  </label>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button type="button" className="btn" onClick={() => setShowCreate(false)}>
                ยกเลิก
              </button>
              <button className="btn btn-primary" type="submit">
                สร้างห้อง
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      <div className="ad-panel">
        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>ลำดับที่</th>
                <th>ห้อง (เลขห้อง)</th>
                <th>สิ่งอำนวยความสะดวก</th>
                <th>ราคา</th>
                <th>สถานะ</th>
                <th style={{ minWidth: 320 }}>ผูกผู้เช่า (กรอก userId)</th>
                <th style={{ minWidth: 200 }}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7}>กำลังโหลด...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7}>ไม่พบข้อมูล</td></tr>
              ) : (
                filtered.flatMap((r, idx) => {
                  const isEdit = editingId === r.room_id;
                  const occupied = r.status === "occupied";

                  const rowMain = (
                    <tr key={r.room_id}>
                      <td>{idx + 1}</td>
                      <td>
                        {r.room_id} <span style={{ opacity: 0.6 }}>({r.room_number || "-"})</span>
                      </td>
                      <td>
                        {r.has_fan ? "พัดลม • " : ""}
                        {r.has_aircon ? "แอร์ • " : ""}
                        {r.has_fridge ? "ตู้เย็น" : ""}
                        {!r.has_fan && !r.has_aircon && !r.has_fridge ? "-" : ""}
                      </td>
                      <td>{currency(r.price)}</td>
                      <td>{ROOM_STATUS_LABEL[r.status] || r.status}</td>

                      {/* bind tenant */}
                      <td>
                        <div style={{ display: "grid", gridTemplateColumns: "160px 170px auto", gap: 8 }}>
                          {/* userId */}
                          <div>
                            <label className="label" htmlFor={`uid-${r.room_id}`}>userId ผู้เช่า</label>
                            <input
                              id={`uid-${r.room_id}`}
                              className="input"
                              disabled={occupied}
                              placeholder="userId"
                              value={bindUserId[r.room_id] || ""}
                              onChange={(e) =>
                                setBindUserId((p) => ({ ...p, [r.room_id]: e.target.value }))
                              }
                            />
                          </div>

                          {/* วันที่เข้าพัก */}
                          <div>
                            <label className="label" htmlFor={`date-${r.room_id}`}>วันที่เข้าพัก</label>
                            <input
                              id={`date-${r.room_id}`}
                              className="input"
                              type="date"
                              disabled={occupied}
                              value={bindDate[r.room_id] || today()}
                              onChange={(e) =>
                                setBindDate((p) => ({ ...p, [r.room_id]: e.target.value }))
                              }
                            />
                          </div>

                          {/* ปุ่ม */}
                          <div style={{ display: "flex", alignItems: "end" }}>
                            <button
                              className="btn btn-primary"
                              disabled={occupied || !bindUserId[r.room_id]}
                              onClick={() => bindTenant(r.room_id)}
                            >
                              ผูกห้อง
                            </button>
                          </div>
                        </div>
                        {occupied ? <small className="muted">ห้องนี้มีผู้เช่าแล้ว</small> : null}
                      </td>

                      {/* actions */}
                      <td style={{ display: "flex", gap: 8 }}>
                        <button className="btn btn-warning" onClick={() => startEdit(r)}>แก้ไข</button>
                        <button className="btn btn-danger" onClick={() => removeRoom(r.room_id)}>ลบ</button>
                      </td>
                    </tr>
                  );

                  const rowEditor = isEdit ? (
                    <tr key={`edit-${r.room_id}`}>
                      <td colSpan={7}>
                        <div className="ad-panel" style={{ marginTop: 12 }}>
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
                              gap: 8,
                            }}
                          >
                            <div>
                              <label className="label">เลขห้อง</label>
                              <input
                                className="input"
                                value={editForm.room_number}
                                onChange={(e) =>
                                  setEditForm((p) => ({ ...p, room_number: e.target.value }))
                                }
                              />
                            </div>
                            <div>
                              <label className="label">ราคา/เดือน</label>
                              <input
                                className="input"
                                type="number"
                                step="0.01"
                                value={editForm.price}
                                onChange={(e) =>
                                  setEditForm((p) => ({ ...p, price: e.target.value }))
                                }
                              />
                            </div>
                            <div>
                              <label className="label">สถานะ</label>
                              <select
                                className="input"
                                value={editForm.status}
                                onChange={(e) =>
                                  setEditForm((p) => ({ ...p, status: e.target.value }))
                                }
                              >
                                {STATUS_OPTIONS.map((o) => (
                                  <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                              </select>
                            </div>
                            <div style={{ gridColumn: "1/-1" }}>
                              <label className="label">สิ่งอำนวยความสะดวก</label>
                              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                                <label>
                                  <input
                                    type="checkbox"
                                    className="checkbox"
                                    checked={editForm.has_fan}
                                    onChange={(e) =>
                                      setEditForm((p) => ({ ...p, has_fan: e.target.checked }))
                                    }
                                  />
                                  <span style={{ marginLeft: 6 }}>พัดลม</span>
                                </label>
                                <label>
                                  <input
                                    type="checkbox"
                                    className="checkbox"
                                    checked={editForm.has_aircon}
                                    onChange={(e) =>
                                      setEditForm((p) => ({ ...p, has_aircon: e.target.checked }))
                                    }
                                  />
                                  <span style={{ marginLeft: 6 }}>แอร์</span>
                                </label>
                                <label>
                                  <input
                                    type="checkbox"
                                    className="checkbox"
                                    checked={editForm.has_fridge}
                                    onChange={(e) =>
                                      setEditForm((p) => ({ ...p, has_fridge: e.target.checked }))
                                    }
                                  />
                                  <span style={{ marginLeft: 6 }}>ตู้เย็น</span>
                                </label>
                              </div>
                            </div>
                          </div>

                          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                            <button className="btn" onClick={() => setEditingId(null)}>ยกเลิก</button>
                            <button className="btn btn-primary" onClick={saveEdit}>บันทึก</button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null;

                 
                  return [rowMain, rowEditor].filter(Boolean);
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {err ? (
        <div className="ad-panel" style={{ marginTop: 12, background: "#ffecec", borderColor: "#f5a5a5" }}>
          {err}
        </div>
      ) : null}
    </div>
  );
}
