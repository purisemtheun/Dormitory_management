// src/pages/tenant/TenantRepairCreatePage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { repairsService } from "../../services/repair.services";
import { getRole } from "../../utils/auth";
import {
  Wrench,
  StickyNote,
  Home,
  Image as ImageIcon,
  CalendarDays,
  Info,
  CheckCircle2,
  Loader2,
  ArrowLeft,
  Send,
} from "lucide-react";

/* วันที่เริ่มต้น = วันนี้ + 7 */
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

  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState("");

  /* เติมเลขห้องอัตโนมัติจาก session (ผู้เช่า) */
  useEffect(() => {
    if (isTenant) {
      const cachedRoom = sessionStorage.getItem("app:tenant:room_id");
      if (cachedRoom && !form.room_id) {
        setForm((prev) => ({ ...prev, room_id: cachedRoom }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTenant]);

  /* จัดการพรีวิว/คืนหน่วยความจำ */
  useEffect(() => {
    if (!imageFile) {
      setPreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

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
        imageFile, // อ่านไฟล์ด้าน backend ผ่าน key นี้
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

  /* UI */
  return (
    <div className="min-h-[calc(100vh-64px)] bg-gradient-to-b from-white to-slate-50">
      <div className="max-w-4xl mx-auto px-6 sm:px-8 py-10">
        {/* Hero */}
        <div className="rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-7 shadow-lg mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
                <Wrench className="w-6 h-6 text-white" />
              </span>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">แจ้งซ่อม</h1>
            </div>
            <p className="text-white/85 mt-2 text-sm sm:text-base">
              กรอกข้อมูลปัญหา พร้อมแนบรูปประกอบ (ถ้ามี) เพื่อให้ช่างวินิจฉัยได้ไวขึ้น
            </p>
          </div>

          <Link
            to="/tenant"
            className="inline-flex items-center gap-2 text-sm font-medium text-white/90 hover:text-white"
            title="กลับหน้าผู้เช่า"
          >
            <ArrowLeft className="w-5 h-5" />
            กลับ
          </Link>
        </div>

        {/* Stepper */}
        <ol className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { icon: StickyNote, label: "รายละเอียด" },
            { icon: ImageIcon, label: "แนบรูป (ถ้ามี)" },
            { icon: CalendarDays, label: "กำหนดวัน" },
            { icon: Send, label: "ส่งคำขอ" },
          ].map((s, i) => (
            <li
              key={s.label}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <s.icon className="w-4 h-4 text-purple-600" />
              <span className="font-medium">{i + 1}. {s.label}</span>
            </li>
          ))}
        </ol>

        {/* Form card */}
        <section className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-6 sm:p-8">
          {apiError && (
            <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700">
              {apiError}
            </div>
          )}

          {/* Tips */}
          <div className="mb-6 rounded-xl border border-indigo-200 bg-indigo-50/60 px-4 py-3 text-sm text-indigo-900 flex items-start gap-2">
            <Info className="w-5 h-5 mt-0.5 text-indigo-600" />
            <p>
              ระบุอาการ/ตำแหน่งให้ชัด เช่น “แอร์ห้องนอนฝั่งระเบียง น้ำหยดต่อเนื่อง” และถ่ายรูปจุดเสีย/สวิทช์/เบรกเกอร์ประกอบ
            </p>
          </div>

          <form onSubmit={submit} className="space-y-7">
            {/* หัวข้อ */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                <span className="inline-flex items-center gap-2">
                  <StickyNote className="w-4 h-4 text-purple-600" /> หัวข้อ
                  <span className="text-rose-600">*</span>
                </span>
              </label>
              <input
                className="w-full h-12 rounded-xl border border-slate-300 px-4 text-base bg-white outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-100"
                name="title"
                value={form.title}
                onChange={onChange}
                placeholder="เช่น แอร์ไม่เย็น / น้ำซึมจากฝ้า / หลอดไฟเสีย"
                required
              />
              {errors.title && <p className="mt-1 text-sm text-rose-600">{errors.title}</p>}
            </div>

            {/* รายละเอียด */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                <span className="inline-flex items-center gap-2">
                  <StickyNote className="w-4 h-4 text-purple-600" /> รายละเอียด
                  <span className="text-rose-600">*</span>
                </span>
              </label>
              <textarea
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base bg-white outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-100"
                name="description"
                value={form.description}
                onChange={onChange}
                placeholder="อธิบายอาการ, จุดที่พบ, ช่วงเวลาที่มีปัญหา, สิ่งที่ลองทำแล้ว ฯลฯ"
                rows={6}
                required
              />
              {errors.description && (
                <p className="mt-1 text-sm text-rose-600">{errors.description}</p>
              )}
            </div>

            {/* ห้อง */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                <span className="inline-flex items-center gap-2">
                  <Home className="w-4 h-4 text-purple-600" /> ห้อง
                  {isTenant ? " (ล็อกสำหรับผู้เช่า)" : ""}{!isTenant ? " *" : ""}
                </span>
              </label>
              <input
                className="w-full h-12 rounded-xl border border-slate-300 px-4 text-base bg-white outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-100 disabled:bg-slate-50 disabled:text-slate-500"
                name="room_id"
                value={form.room_id}
                onChange={onChange}
                placeholder={isTenant ? "ระบบจะใช้ห้องของคุณโดยอัตโนมัติ" : "เช่น A203"}
                disabled={isTenant}
                required={!isTenant}
              />
              {errors.room_id && <p className="mt-1 text-sm text-rose-600">{errors.room_id}</p>}
              {isTenant && (
                <p className="mt-1 text-xs text-slate-500">
                  หากระบบยังไม่รู้จักห้องของคุณ โปรดติดต่อแอดมินเพื่อตรวจสอบการผูกบัญชีผู้เช่า
                </p>
              )}
            </div>

            {/* อัปโหลดรูป */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                <span className="inline-flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-purple-600" /> อัปโหลดรูปภาพ (ถ้ามี)
                </span>
              </label>

              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-4">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                  className="block w-full h-12 rounded-lg border border-slate-300 px-3 file:mr-4 file:py-2.5 file:px-5 file:rounded-lg file:border-0 file:bg-purple-600 file:text-white hover:file:bg-purple-700 cursor-pointer bg-white"
                />
                {(previewUrl || form.image_url) && (
                  <div className="mt-3">
                    <img
                      src={previewUrl || form.image_url}
                      alt="พรีวิวรูปแจ้งซ่อม"
                      onError={(e) => (e.currentTarget.style.display = "none")}
                      className="block w-full max-h-80 object-contain rounded-lg border border-slate-200 shadow-sm"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* วันสิ้นสุด */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                <span className="inline-flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-purple-600" /> กำหนดวันสิ้นสุด (ถ้ามี)
                </span>
              </label>
              <input
                className="w-full h-12 rounded-xl border border-slate-300 px-4 text-base bg-white outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-100"
                type="date"
                name="due_date"
                value={form.due_date}
                min={new Date().toISOString().slice(0, 10)}
                onChange={onChange}
              />
              {errors.due_date && <p className="mt-1 text-sm text-rose-600">{errors.due_date}</p>}
            </div>

            {/* ปุ่ม */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Link
                to="/tenant"
                className="inline-flex items-center justify-center h-12 px-5 gap-2 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              >
                <ArrowLeft className="w-5 h-5" />
                ยกเลิก
              </Link>
              <button
                className="inline-flex items-center justify-center h-12 px-6 gap-2 rounded-xl bg-purple-600 text-white font-semibold shadow-sm hover:bg-purple-700 disabled:opacity-50"
                disabled={submitting}
                type="submit"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    กำลังส่ง...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    ส่งคำขอแจ้งซ่อม
                  </>
                )}
              </button>
            </div>

            {/* หมายเหตุเล็กๆ */}
            <p className="flex items-center gap-2 text-xs text-slate-500">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              หลังส่งแล้ว คุณจะได้รับการอัปเดตสถานะในหน้า “แจ้งซ่อมของฉัน”
            </p>
          </form>
        </section>
      </div>
    </div>
  );
}
