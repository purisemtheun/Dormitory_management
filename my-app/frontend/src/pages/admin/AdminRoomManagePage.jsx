import React, { useEffect, useMemo, useState } from "react";
import { roomApi } from "../../services/room.api";

function currency(n){ return (n===null||n===undefined) ? "-" : Number(n).toLocaleString(); }
const today = () => new Date().toISOString().slice(0,10);

export default function AdminRoomsManagePage(){
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ room_id:"", room_number:"", type:"", price:"", status:"available" });

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ room_number:"", type:"", price:"", status:"available" });

  const [bindUserId, setBindUserId] = useState({});
  const [bindDate, setBindDate] = useState({});

  const load = async () => {
    setLoading(true); setErr("");
    try{
      const data = await roomApi.list();
      setRows(Array.isArray(data) ? data : []);
    }catch(e){ setErr(e?.response?.data?.error || e.message); }
    finally{ setLoading(false); }
  };
  useEffect(()=>{ load(); }, []);

  const filtered = useMemo(()=>{
    const kw = q.trim().toLowerCase();
    if(!kw) return rows;
    return rows.filter(r =>
      String(r.room_id).toLowerCase().includes(kw) ||
      String(r.room_number||"").toLowerCase().includes(kw) ||
      String(r.type||"").toLowerCase().includes(kw) ||
      String(r.status||"").toLowerCase().includes(kw)
    );
  }, [rows, q]);

  const onCreate = async (e) => {
    e.preventDefault();
    try{
      await roomApi.create({
        room_id: createForm.room_id.trim(),
        room_number: createForm.room_number.trim(),
        type: createForm.type || null,
        price: createForm.price || null,
        status: createForm.status || "available",
      });
      setShowCreate(false);
      setCreateForm({ room_id:"", room_number:"", type:"", price:"", status:"available" });
      await load();
    }catch(e){ alert(e?.response?.data?.error || e.message); }
  };

  const startEdit = (r) => {
    setEditingId(r.room_id);
    setEditForm({
      room_number: r.room_number || "",
      type: r.type || "",
      price: r.price ?? "",
      status: r.status || "available",
    });
  };
  const saveEdit = async () => {
    try{
      await roomApi.update(editingId, editForm);
      setEditingId(null);
      await load();
    }catch(e){ alert(e?.response?.data?.error || e.message); }
  };
  const removeRoom = async (id) => {
    if(!window.confirm(`ลบห้อง ${id}?`)) return;
    try{ await roomApi.remove(id); await load(); }
    catch(e){ alert(e?.response?.data?.error || e.message); }
  };

  const bindTenant = async (room_id) => {
    const userIdRaw = bindUserId[room_id];
    const userId = Number(userIdRaw);
    if(!userIdRaw || Number.isNaN(userId)) return alert("กรุณากรอก userId ของผู้เช่า (ตัวเลข)");
    try{
      await roomApi.bookForTenant(room_id, { userId, checkin_date: bindDate[room_id] || today() });
      setBindUserId(p=>({ ...p, [room_id]: "" }));
      setBindDate(p=>({ ...p, [room_id]: "" }));
      await load();
    }catch(e){ alert(e?.response?.data?.error || e.message); }
  };

  return (
    <div>
      <div className="ad-header">
        <h2 style={{margin:0}}>จัดการห้องพัก</h2>
        <div style={{display:"flex", gap:8}}>
          <input className="input" placeholder="ค้นหา: room_id / เลขห้อง / ประเภท / สถานะ"
                 value={q} onChange={e=>setQ(e.target.value)} />
          <button className="btn btn-outline" onClick={load}>รีเฟรช</button>
          <button className="btn btn-primary" onClick={()=>setShowCreate(v=>!v)}>
            {showCreate ? "ปิดฟอร์ม" : "สร้างห้อง"}
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="ad-panel" style={{marginBottom:12}}>
          <form onSubmit={onCreate}>
            <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:8}}>
              <div>
                <label className="label">room_id*</label>
                <input className="input" required value={createForm.room_id}
                       onChange={e=>setCreateForm(p=>({...p, room_id:e.target.value}))}/>
              </div>
              <div>
                <label className="label">เลขห้อง*</label>
                <input className="input" required value={createForm.room_number}
                       onChange={e=>setCreateForm(p=>({...p, room_number:e.target.value}))}/>
              </div>
              <div>
                <label className="label">ประเภท</label>
                <input className="input" value={createForm.type}
                       onChange={e=>setCreateForm(p=>({...p, type:e.target.value}))}/>
              </div>
              <div>
                <label className="label">ราคา/เดือน</label>
                <input className="input" type="number" step="0.01" value={createForm.price}
                       onChange={e=>setCreateForm(p=>({...p, price:e.target.value}))}/>
              </div>
              <div>
                <label className="label">สถานะ</label>
                <select className="input" value={createForm.status}
                        onChange={e=>setCreateForm(p=>({...p, status:e.target.value}))}>
                  <option value="available">available</option>
                  <option value="occupied">occupied</option>
                  <option value="maintenance">maintenance</option>
                </select>
              </div>
            </div>
            <div style={{display:"flex", gap:8, marginTop:10}}>
              <button type="button" className="btn" onClick={()=>setShowCreate(false)}>ยกเลิก</button>
              <button className="btn btn-primary" type="submit">สร้างห้อง</button>
            </div>
          </form>
        </div>
      )}

      <div className="ad-panel">
        <div style={{overflowX:"auto"}}>
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>ห้อง (เลขห้อง)</th>
                <th>ประเภท</th>
                <th>ราคา</th>
                <th>สถานะ</th>
                <th style={{minWidth:320}}>ผูกผู้เช่า (กรอก userId)</th>
                <th style={{minWidth:200}}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7">กำลังโหลด...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan="7">ไม่พบข้อมูล</td></tr>
              ) : filtered.map((r, idx) => {
                const isEdit = editingId === r.room_id;
                const occupied = r.status === "occupied";
                return (
                  <React.Fragment key={r.room_id}>
                    <tr>
                      <td>{idx+1}</td>
                      <td>{r.room_id} <span style={{opacity:.6}}>({r.room_number || "-"})</span></td>
                      <td>{r.type || "-"}</td>
                      <td>{currency(r.price)}</td>
                      <td>{r.status}</td>
                      <td>
                        <div style={{display:"grid", gridTemplateColumns:"160px 170px auto", gap:8}}>
                          <input className="input" disabled={occupied} placeholder="userId"
                                 value={bindUserId[r.room_id] || ""}
                                 onChange={e=>setBindUserId(p=>({ ...p, [r.room_id]: e.target.value }))}/>
                          <input className="input" type="date" disabled={occupied}
                                 value={bindDate[r.room_id] || today()}
                                 onChange={e=>setBindDate(p=>({ ...p, [r.room_id]: e.target.value }))}/>
                          <button className="btn btn-primary"
                                  disabled={occupied || !bindUserId[r.room_id]}
                                  onClick={()=>bindTenant(r.room_id)}>
                            ผูกห้อง
                          </button>
                        </div>
                        {occupied && <small className="muted">ห้องนี้มีผู้เช่าแล้ว</small>}
                      </td>
                      <td style={{display:"flex", gap:8}}>
                        <button className="btn btn-warning" onClick={()=>startEdit(r)}>แก้ไข</button>
                        <button className="btn btn-danger" onClick={()=>removeRoom(r.room_id)}>ลบ</button>
                      </td>
                    </tr>
                    {isEdit && (
                      <tr>
                        <td colSpan="7">
                          <div className="ad-panel" style={{marginTop:12}}>
                            <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:8}}>
                              <div>
                                <label className="label">เลขห้อง</label>
                                <input className="input" value={editForm.room_number}
                                       onChange={e=>setEditForm(p=>({...p, room_number:e.target.value}))}/>
                              </div>
                              <div>
                                <label className="label">ประเภท</label>
                                <input className="input" value={editForm.type}
                                       onChange={e=>setEditForm(p=>({...p, type:e.target.value}))}/>
                              </div>
                              <div>
                                <label className="label">ราคา/เดือน</label>
                                <input className="input" type="number" step="0.01" value={editForm.price}
                                       onChange={e=>setEditForm(p=>({...p, price:e.target.value}))}/>
                              </div>
                              <div>
                                <label className="label">สถานะ</label>
                                <select className="input" value={editForm.status}
                                        onChange={e=>setEditForm(p=>({...p, status:e.target.value}))}>
                                  <option value="available">available</option>
                                  <option value="occupied">occupied</option>
                                  <option value="maintenance">maintenance</option>
                                </select>
                              </div>
                            </div>
                            <div style={{display:"flex", gap:8, marginTop:10}}>
                              <button className="btn" onClick={()=>setEditingId(null)}>ยกเลิก</button>
                              <button className="btn btn-primary" onClick={saveEdit}>บันทึก</button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {err && <div className="ad-panel" style={{marginTop:12, background:"#ffecec", borderColor:"#f5a5a5"}}>{err}</div>}
    </div>
  );
}
