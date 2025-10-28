// src/pages/auth/LoginPage.jsx
import React, { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { loginApi } from "../../services/auth.api.js";
import { saveToken, getRole } from "../../utils/auth.js";
import loginSvg from "../../assets/Login.svg";
import loginJpg from "../../assets/Login.jpg";




const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || "/";

  const canSubmit = useMemo(
    () => EMAIL_RE.test(email) && password.length >= 1 && !loading,
    [email, password, loading]
  );

  const onSubmit = async (e) => {
    e.preventDefault();

    const nextErr = {};
    if (!EMAIL_RE.test(email)) nextErr.email = "อีเมลไม่ถูกต้อง";
    if (!password) nextErr.password = "กรุณากรอกรหัสผ่าน";
    setErrors(nextErr);
    if (Object.keys(nextErr).length) return;

    try {
      setLoading(true);
      const resp = await loginApi({ email, password });
      // รองรับทั้ง token หรือ access_token และรองรับกรณีใส่ Bearer มาด้วย
      const raw = resp?.token ?? resp?.access_token ?? "";
      const jwt = String(raw).replace(/^Bearer\s+/i, ""); // ตัดคำว่า Bearer ออก

      // ใช้ค่า remember จาก checkbox จริง ๆ
      saveToken(jwt, { remember });

      // อ่าน role จาก JWT แล้วนำทางให้ตรงกับ routes ของโปรเจกต์
      const role = getRole();
      const go =
        role === "admin" || role === "staff"
          ? "/admin"
          : role === "technician"
          ? "/technician"
          : role === "tenant"
          ? "/tenant"
          : from; // ถ้าไม่มี role ก็กลับ path เดิม

      navigate(go, { replace: true });
    } catch (err) {
      const api = err?.response?.data || {};
      if (api.errors && typeof api.errors === "object") setErrors(api.errors);
      else setErrors({ general: api.message || api.error || "เข้าสู่ระบบไม่สำเร็จ" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* --- BG ให้คุณตกแต่งเองได้ตามเดิม --- */}
<div className="fixed inset-0 -z-10 bg-gradient-to-br from-indigo-50 to-white" />

{/* --- Wrapper กลางจอ --- */}
<div className="min-h-screen grid place-items-center px-4 py-10">
  {/* กล่องหลัก แบ่งซ้าย/ขวา */}
  <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-0
                  rounded-3xl border-2 border-indigo-800 bg-white shadow-[0_20px_80px_rgba(2,6,23,.15)] overflow-hidden">

    {/* ===== ฝั่งซ้าย: ฟอร์ม Login ===== */}
    <section className="p-8 md:p-10">
      {/* โลโก้/ชื่อระบบ */}
      <div className="mb-6">
        <div className="inline-flex items-center gap-3">
          {/* ถ้ามี SVG โลโก้ ให้เอามาใส่แทน div นี้ */}
          <div className="h-10 w-10 rounded-xl bg-indigo-700 text-white grid place-items-center
                          text-base font-bold border border-indigo-800">DM</div>
          <div className="text-xl font-extrabold tracking-tight text-slate-900">
            ระบบจัดการหอพัก
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-1">เข้าสู่บัญชีของคุณ</p>
      </div>

      {/* ฟอร์มเดิม: นำ state/handlers ของคุณมาใช้เหมือนเดิม */}
      <form onSubmit={onSubmit} className="space-y-5">
        {errors.general && (
          <p className="rounded bg-red-50 text-red-700 px-3 py-2 text-sm">{errors.general}</p>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">อีเมล</label>
          <input
            className={`w-full px-3 py-2 rounded-lg border ${errors.email ? "border-red-400" : "border-slate-300"} focus:outline-none focus:ring-2 focus:ring-indigo-500`}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
          />
          {errors.email ? (
            <p className="text-xs text-red-600 mt-1">{errors.email}</p>
          ) : (
            <p className="text-xs text-slate-500 mt-1">ใช้รูปแบบอีเมลมาตรฐาน</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">รหัสผ่าน</label>
          <div className="relative">
            <input
              className={`w-full px-3 py-2 pr-24 rounded-lg border ${errors.password ? "border-red-400" : "border-slate-300"} focus:outline-none focus:ring-2 focus:ring-indigo-500`}
              type={showPwd ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="********"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPwd((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs rounded hover:bg-slate-100"
            >
              {showPwd ? "ซ่อน" : "แสดง"}
            </button>
          </div>
          {errors.password && <p className="text-xs text-red-600 mt-1">{errors.password}</p>}
        </div>

        <div className="flex items-center justify-between">
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            จำฉันไว้
          </label>
          <span className="text-xs text-slate-500">ลืมรหัสผ่าน?</span>
        </div>

        {/* ปุ่มตามสีที่คุณระบุ */}
        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full px-4 py-2 text-sm rounded-lg bg-indigo-700 text-white font-medium border border-indigo-800
                     hover:bg-indigo-800 disabled:opacity-50 transition-colors"
        >
          {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
        </button>

        <p className="text-center text-xs text-slate-600">
          ยังไม่มีบัญชี?{" "}
          <Link to="/register" className="text-indigo-700 underline-offset-2 hover:underline">
            สมัครสมาชิก
          </Link>
        </p>
      </form>
    </section>

    {/* ===== ฝั่งขวา: พื้นที่รูปภาพ/อิลลัส ===== */}
    <aside className="relative hidden md:block bg-slate-50">
      {/* เส้นขอบในโทนเดียวกัน */}
      <div className="absolute inset-4 rounded-2xl border-2 border-indigo-800 pointer-events-none" />
      {/* พื้นหลังโทนอ่อน */}
      <div className="h-full w-full grid place-items-center p-8">
        {/* TODO: ใส่รูปของคุณทีหลัง — ดูข้อ 2 ด้านล่าง */}
        <div className="text-center text-slate-500">
          <picture>
  <source srcSet={loginSvg} type="image/svg+xml" />
  <img src={loginJpg} alt="login illustration" loading="lazy"
       className="max-w-[560px] w-full h-auto object-contain select-none" />
</picture>
        </div>
      </div>
    </aside>
  </div>
</div>

    </>
  );
}
