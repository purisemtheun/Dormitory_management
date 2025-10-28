// src/pages/auth/RegisterPage.jsx
import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerApi } from "../../services/auth.api.js";

// === ใส่ภาพประกอบด้านขวา (แก้ path ตามไฟล์ของคุณ) ===
import loginArt from "../../assets/Login.svg"; // หรือ "../../assets/Login.jpg"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const PHONE_RE = /^0\d{9}$/;

const ROLE_OPTIONS = [
  { label: "ผู้เช่า", value: "tenant" },
  { label: "ช่าง", value: "technician" },
  { label: "แอดมิน", value: "admin" },
];

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("tenant");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [agree, setAgree] = useState(false);

  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const canSubmit = useMemo(
    () =>
      name.trim().length >= 2 &&
      EMAIL_RE.test(email) &&
      PHONE_RE.test(phone) &&
      password.length >= 8 &&
      password === confirm &&
      agree &&
      !loading,
    [name, email, phone, password, confirm, agree, loading]
  );

  const onSubmit = async (e) => {
    e.preventDefault();
    setSuccess("");
    const nextErr = {};
    if (!name.trim()) nextErr.name = "กรุณากรอกชื่อ";
    if (!EMAIL_RE.test(email)) nextErr.email = "อีเมลไม่ถูกต้อง";
    if (!PHONE_RE.test(phone)) nextErr.phone = "กรุณากรอกเบอร์ 10 หลักขึ้นต้น 0";
    if (password.length < 8) nextErr.password = "รหัสผ่านอย่างน้อย 8 ตัว";
    if (confirm !== password) nextErr.confirm = "รหัสผ่านไม่ตรงกัน";
    if (!agree) nextErr.agree = "กรุณายอมรับเงื่อนไข";
    setErrors(nextErr);
    if (Object.keys(nextErr).length) return;

    try {
      setLoading(true);
      await registerApi({ name, email, phone, password, role });
      setErrors({});
      setSuccess("ลงทะเบียนสำเร็จ");
      setTimeout(() => {
        navigate("/login", { replace: true });
      }, 1200);
    } catch (err) {
      const api = err?.response?.data || {};
      if (api.errors && typeof api.errors === "object") {
        setErrors(api.errors);
      } else if (
        err?.response?.status === 409 ||
        api.code === "EMAIL_EXISTS" ||
        api.error === "Email already exists"
      ) {
        setErrors({ email: "อีเมลนี้ถูกใช้แล้ว" });
      } else if (api.error) {
        setErrors({ general: api.error });
      } else if (api.message) {
        setErrors({ general: api.message });
      } else {
        setErrors({ general: "สมัครสมาชิกไม่สำเร็จ" });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* พื้นหลังโทนอ่อน คุมโทนกับหน้า Login */}
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-indigo-50 via-slate-50 to-white" />

      <div className="max-w-6xl mx-auto px-4 py-10">
        {/* การ์ดครึ่งซ้าย-ขวา */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 rounded-2xl shadow-xl border border-slate-200 overflow-hidden bg-white">
          {/* ซ้าย: แบบฟอร์ม */}
          <div className="lg:col-span-6 p-8 sm:p-10">
            <div className="mb-8">
              <div className="inline-flex items-center gap-2 rounded-xl px-3 py-2 bg-indigo-600 text-white border border-indigo-700">
                ระบบจัดการหอพัก
              </div>
              <h1 className="mt-4 text-2xl font-extrabold text-slate-900">
                สมัครสมาชิก
              </h1>
              <p className="text-slate-500 mt-1 text-sm">
                สร้างบัญชีใหม่เพื่อเริ่มใช้งาน
              </p>
            </div>

            {errors.general && (
              <p className="rounded bg-red-50 text-red-700 px-3 py-2 text-sm mb-3">
                {errors.general}
              </p>
            )}
            {success && (
              <p className="rounded bg-green-50 text-green-700 px-3 py-2 text-sm mb-3">
                {success}
              </p>
            )}

            <form onSubmit={onSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  ชื่อที่แสดง
                </label>
                <input
                  className={`mt-1 w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                    errors.name ? "border-red-300" : "border-slate-300"
                  }`}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="เช่น สมชาย ผู้เช่า"
                  autoComplete="name"
                />
                {errors.name && (
                  <p className="text-sm text-red-600 mt-1">{errors.name}</p>
                )}
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    อีเมล
                  </label>
                  <input
                    className={`mt-1 w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                      errors.email ? "border-red-300" : "border-slate-300"
                    }`}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                  {errors.email ? (
                    <p className="text-sm text-red-600 mt-1">{errors.email}</p>
                  ) : (
                    <p className="text-xs text-slate-400 mt-1">
                      ใช้รูปแบบอีเมลมาตรฐาน
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    เบอร์โทร
                  </label>
                  <input
                    className={`mt-1 w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                      errors.phone ? "border-red-300" : "border-slate-300"
                    }`}
                    type="tel"
                    value={phone}
                    onChange={(e) =>
                      setPhone(e.target.value.replace(/[^\d]/g, "").slice(0, 10))
                    }
                    placeholder="0XXXXXXXXX"
                    autoComplete="tel"
                    maxLength={10}
                  />
                  {errors.phone ? (
                    <p className="text-sm text-red-600 mt-1">{errors.phone}</p>
                  ) : (
                    <p className="text-xs text-slate-400 mt-1">
                      กรอก 10 หลักขึ้นต้นด้วย 0
                    </p>
                  )}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    บทบาท
                  </label>
                  <select
                    className={`mt-1 w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                      errors.role ? "border-red-300" : "border-slate-300"
                    }`}
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                  >
                    {ROLE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  {errors.role && (
                    <p className="text-sm text-red-600 mt-1">{errors.role}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    รหัสผ่าน
                  </label>
                  <input
                    className={`mt-1 w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                      errors.password ? "border-red-300" : "border-slate-300"
                    }`}
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="อย่างน้อย 8 ตัว"
                    autoComplete="new-password"
                  />
                  {errors.password && (
                    <p className="text-sm text-red-600 mt-1">
                      {errors.password}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  ยืนยันรหัสผ่าน
                </label>
                <input
                  className={`mt-1 w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                    errors.confirm ? "border-red-300" : "border-slate-300"
                  }`}
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="พิมพ์อีกครั้ง"
                  autoComplete="new-password"
                />
                {errors.confirm && (
                  <p className="text-sm text-red-600 mt-1">{errors.confirm}</p>
                )}
              </div>

              <label className="inline-flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  checked={agree}
                  onChange={(e) => setAgree(e.target.checked)}
                />
                <span>ฉันยอมรับเงื่อนไขการใช้งาน</span>
              </label>
              {errors.agree && (
                <p className="text-sm text-red-600">{errors.agree}</p>
              )}

              {/* ปุ่มสไตล์เดียวกับที่ขอ */}
              <button
                type="submit"
                className="w-full px-4 py-2 text-sm rounded-lg bg-indigo-700 text-white font-medium border border-indigo-800 disabled:opacity-50"
                disabled={!canSubmit}
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v4A4 4 0 004 12z"
                      />
                    </svg>
                    กำลังสมัครสมาชิก...
                  </span>
                ) : (
                  "สมัครสมาชิก"
                )}
              </button>

              <p className="text-center text-sm">
                มีบัญชีแล้ว?{" "}
                <Link to="/login" className="text-indigo-600 hover:underline">
                  เข้าสู่ระบบ
                </Link>
              </p>
            </form>
          </div>

          {/* ขวา: ภาพประกอบ / ฮีโร่ */}
          <aside className="lg:col-span-6 bg-slate-50 grid place-items-center p-8">
            {/* ถ้าอยากรองรับทั้ง SVG และ JPG ใช้ <picture> ได้ */}
            {/* <picture>
              <source srcSet={loginArt} type="image/svg+xml" />
              <img src={loginFallbackJpg} alt="illustration" className="max-w-[560px] w-full h-auto object-contain" />
            </picture> */}
            <img
              src={loginArt}
              alt="illustration"
              loading="lazy"
              className="max-w-[560px] w-full h-auto object-contain select-none"
            />
          </aside>
        </div>
      </div>
    </>
  );
}
