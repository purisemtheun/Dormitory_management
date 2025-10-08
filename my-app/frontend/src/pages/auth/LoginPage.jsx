// src/pages/auth/LoginPage.jsx
import React, { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { loginApi } from "../../services/auth.api.js";
import { saveToken, getRole } from "../../utils/auth.js";

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
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-indigo-50 to-white" />
      <div className="page">
        <form onSubmit={onSubmit} className="card space-y-6">
          <div className="text-center space-y-1">
            <div className="mx-auto h-12 w-12 rounded-2xl bg-indigo-600 text-white grid place-items-center text-lg font-bold">
              เว็บแอพลิเคชั่นระบบจัดการหอพัก
            </div>
            <h1 className="text-xl font-bold">เข้าสู่ระบบ</h1>
          </div>

          {errors.general && (
            <p className="rounded bg-red-50 text-red-700 px-3 py-2 text-sm">
              {errors.general}
            </p>
          )}

          <div>
            <label className="label">อีเมล</label>
            <input
              className={`input ${errors.email ? "input-error" : ""}`}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              autoFocus
            />
            {errors.email ? (
              <p className="text-sm text-red-600 mt-1">{errors.email}</p>
            ) : (
              <p className="help mt-1">ใช้รูปแบบอีเมลมาตรฐาน</p>
            )}
          </div>

          <div>
            <label className="label">รหัสผ่าน</label>
            <div className="relative">
              <input
                className={`input pr-24 ${errors.password ? "input-error" : ""}`}
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="********"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-sm rounded px-2 py-1 hover:bg-gray-100"
              >
                {showPwd ? "ซ่อน" : "แสดง"}
              </button>
            </div>
            {errors.password && (
              <p className="text-sm text-red-600 mt-1">{errors.password}</p>
            )}
          </div>

          <div className="flex items-center justify-between">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              <span>จำฉันไว้</span>
            </label>
            <span className="text-sm text-gray-500">ลืมรหัสผ่าน?</span>
          </div>

          <button type="submit" disabled={!canSubmit} className="btn-primary w-full">
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4A4 4 0 004 12z"/>
                </svg>
                กำลังเข้าสู่ระบบ...
              </span>
            ) : (
              "เข้าสู่ระบบ"
            )}
          </button>

          <p className="text-center text-sm">
            ยังไม่มีบัญชี?{" "}
            <Link to="/register" className="text-indigo-600 hover:underline">
              สมัครสมาชิก
            </Link>
          </p>
        </form>
      </div>
    </>
  );
}
