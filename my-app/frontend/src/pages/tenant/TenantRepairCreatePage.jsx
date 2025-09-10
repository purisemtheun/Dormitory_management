import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { repairsService } from "../../services/repair.services";
import { getRole } from "../../utils/auth";

function todayPlus(days = 7) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function TenantRepairCreatePage() {
  const nav = useNavigate();
  const role = useMemo(() => (typeof getRole === "function" ? getRole() : null), []);
  const isTenant = role === "tenant";

  const [form, setForm] = useState({
    title: "",
    description: "",
    room_id: "",
    image_url: "",
    due_date: todayPlus(7),
  });

  const [imageFile, setImageFile] = useState(null); // เพิ่ม state สำหรับไฟล์
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState("");

  useEffect(() => {
    if (isTenant) {
      const cachedRoom = sessionStorage.getItem("app:tenant:room_id");
      if (cachedRoom && !form.room_id) {
        setForm((prev) => ({ ...prev, room_id: cachedRoom }));
      }
    }
    // eslint-disable-next-line
  }, [isTenant]);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
    setApiError("");
  };

  const validate = () => {
    const e = {};
    if (!form.title.trim()) e.title = "กรุณากรอกหัวข้อ";
    if (!form.description.trim()) e.description = "กรุณากรอกรายละเอียด";
    if (!isTenant && !form.room_id.trim()) e.room_id = "กรุณาระบุห้อง";
    if (form.due_date && !/^\d{4}-\d{2}-\d{2}$/.test(form.due_date))
      e.due_date = "รูปแบบวันที่ไม่ถูกต้อง (YYYY-MM-DD)";
    return e;
  };

  const submit = async (e) => {
    e.preventDefault();
    const eobj = validate();
    setErrors(eobj);
    if (Object.keys(eobj).length) return;

    setSubmitting(true);
    setApiError("");
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        image_url: form.image_url.trim() || undefined,
        due_date: form.due_date || undefined,
        room_id: form.room_id.trim() || undefined,
        imageFile, // ส่งไฟล์ไปกับ payload
      };
      await repairsService.create(payload);
      nav("/tenant");
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || "เกิดข้อผิดพลาด";
      setApiError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page">
      <div className="card" style={{ maxWidth: 720, margin: "0 auto" }}>
        <h2>แจ้งซ่อม</h2>
        <p style={{ marginTop: 4, opacity: 0.85 }}>
          กรุณากรอกข้อมูลให้ครบถ้วน หากคุณเป็นผู้เช่า ระบบจะใช้ห้องของคุณโดยอัตโนมัติ
        </p>

        {apiError ? (
          <div className="card" style={{ background: "#ffecec", border: "1px solid #f5a5a5", marginTop: 12 }}>
            {apiError}
          </div>
        ) : null}

        <form onSubmit={submit} className="form" style={{ marginTop: 12 }}>
          <div className="form-row" style={{ marginBottom: 10 }}>
            <label>หัวข้อ*</label>
            <input
              className="input"
              name="title"
              value={form.title}
              onChange={onChange}
              placeholder="เช่น แอร์ไม่เย็น / หลอดไฟเสีย"
              required
            />
            {errors.title && <small style={{ color: "crimson" }}>{errors.title}</small>}
          </div>

          <div className="form-row" style={{ marginBottom: 10 }}>
            <label>รายละเอียด*</label>
            <textarea
              className="input"
              name="description"
              value={form.description}
              onChange={onChange}
              placeholder="ระบุอาการ/ตำแหน่ง/ช่วงเวลาที่เป็น"
              rows={5}
              required
            />
            {errors.description && <small style={{ color: "crimson" }}>{errors.description}</small>}
          </div>

          <div className="form-row" style={{ marginBottom: 10 }}>
            <label>ห้อง{isTenant ? " (ล็อกสำหรับผู้เช่า)" : ""}{!isTenant ? "*" : ""}</label>
            <input
              className="input"
              name="room_id"
              value={form.room_id}
              onChange={onChange}
              placeholder={isTenant ? "ระบบจะใช้ห้องของคุณโดยอัตโนมัติ" : "เช่น A203"}
              disabled={isTenant}
              required={!isTenant}
            />
            {errors.room_id && <small style={{ color: "crimson" }}>{errors.room_id}</small>}
            {isTenant && (
              <small style={{ display: "block", opacity: 0.7 }}>
                หากระบบยังไม่รู้จักห้องของคุณ โปรดติดต่อแอดมินเพื่อตรวจสอบการผูกบัญชีผู้เช่า
              </small>
            )}
        

      
         
            {form.image_url ? (
              <div style={{ marginTop: 8 }}>
                <img
                  src={form.image_url}
                  alt="preview"
                  style={{ maxWidth: "100%", maxHeight: 240, objectFit: "contain", borderRadius: 8 }}
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              </div>
            ) : null}
          </div>

          <div className="form-row" style={{ marginBottom: 10 }}>
            <label>อัปโหลดรูปภาพ (ถ้ามี)</label>
            <input
              type="file"
              accept="image/*"
              onChange={e => setImageFile(e.target.files?.[0] || null)}
            />
            {imageFile && (
              <div style={{ marginTop: 8 }}>
                <img
                  src={URL.createObjectURL(imageFile)}
                  alt="preview"
                  style={{ maxWidth: "100%", maxHeight: 240, objectFit: "contain", borderRadius: 8 }}
                />
              </div>
            )}
          </div>

          <div className="form-row" style={{ marginBottom: 10 }}>
            <label>กำหนดวันสิ้นสุด (ถ้ามี)</label>
            <input
              className="input"
              type="date"
              name="due_date"
              value={form.due_date}
              min={new Date().toISOString().slice(0, 10)}
              onChange={onChange}
            />
            {errors.due_date && <small style={{ color: "crimson" }}>{errors.due_date}</small>}
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <Link className="btn" to="/tenant">ยกเลิก</Link>
            <button className="btn-primary" disabled={submitting} type="submit">
              {submitting ? "กำลังส่ง..." : "ส่งคำขอแจ้งซ่อม"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}