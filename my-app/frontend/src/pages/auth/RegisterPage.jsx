import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerApi } from "../../services/auth.api.js";

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
  const [success, setSuccess] = useState(""); // ✅ ข้อความสำเร็จ
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
    setSuccess(""); // เคลียร์ก่อน
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

      // ✅ โชว์ข้อความสำเร็จ แล้วค่อยเด้งไปหน้า Login
      setErrors({});
      setSuccess("ลงทะเบียนสำเร็จ");
      setTimeout(() => {
        navigate("/login", { replace: true });
      }, 1200);
    } catch (err) {
      const api = err?.response?.data || {};
      if (api.errors && typeof api.errors === "object") {
        setErrors(api.errors);
      } else if (err?.response?.status === 409 || api.code === "EMAIL_EXISTS" || api.error === "Email already exists") {
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
    <div className="page">
      <form onSubmit={onSubmit} className="card space-y-5">
        <div>
          <h1 className="text-2xl font-bold">สมัครสมาชิก</h1>
          <p className="muted mt-1">สร้างบัญชีใหม่เพื่อเริ่มใช้งาน</p>
        </div>

        {errors.general && (
          <p className="rounded bg-red-50 text-red-700 px-3 py-2 text-sm">{errors.general}</p>
        )}
        {success && (
          <p className="rounded bg-green-50 text-green-700 px-3 py-2 text-sm">{success}</p>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="label">ชื่อที่แสดง</label>
            <input
              className={`input ${errors.name ? "input-error" : ""}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="เช่น สมชาย ผู้เช่า"
              autoComplete="name"
            />
            {errors.name && <p className="text-sm text-red-600 mt-1">{errors.name}</p>}
          </div>

          <div>
            <label className="label">อีเมล</label>
            <input
              className={`input ${errors.email ? "input-error" : ""}`}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
            {errors.email ? (
              <p className="text-sm text-red-600 mt-1">{errors.email}</p>
            ) : (
              <p className="help mt-1">ใช้รูปแบบอีเมลมาตรฐาน</p>
            )}
          </div>

          <div>
            <label className="label">เบอร์โทร</label>
            <input
              className={`input ${errors.phone ? "input-error" : ""}`}
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, "").slice(0, 10))}
              placeholder="0XXXXXXXXX"
              autoComplete="tel"
              maxLength={10}
            />
            {errors.phone ? (
              <p className="text-sm text-red-600 mt-1">{errors.phone}</p>
            ) : (
              <p className="help mt-1">กรอก 10 หลักขึ้นต้นด้วย 0</p>
            )}
          </div>

          <div>
            <label className="label">บทบาท</label>
            <select
              className={`select ${errors.role ? "input-error" : ""}`}
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {errors.role && <p className="text-sm text-red-600 mt-1">{errors.role}</p>}
          </div>

          <div>
            <label className="label">รหัสผ่าน</label>
            <input
              className={`input ${errors.password ? "input-error" : ""}`}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="อย่างน้อย 8 ตัว"
              autoComplete="new-password"
            />
            {errors.password && <p className="text-sm text-red-600 mt-1">{errors.password}</p>}
          </div>

          <div>
            <label className="label">ยืนยันรหัสผ่าน</label>
            <input
              className={`input ${errors.confirm ? "input-error" : ""}`}
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="พิมพ์อีกครั้ง"
              autoComplete="new-password"
            />
            {errors.confirm && <p className="text-sm text-red-600 mt-1">{errors.confirm}</p>}
          </div>
        </div>

        <label className="inline-flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="checkbox mt-1"
            checked={agree}
            onChange={(e) => setAgree(e.target.checked)}
          />
          <span>ฉันยอมรับเงื่อนไขการใช้งาน</span>
        </label>
        {errors.agree && <p className="text-sm text-red-600">{errors.agree}</p>}

        <button type="submit" className="btn-primary w-full" disabled={!canSubmit}>
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4A4 4 0 004 12z"/>
              </svg>
              กำลังสมัครสมาชิก...
            </span>
          ) : (
            "สมัครสมาชิก"
          )}
        </button>

        <p className="text-center text-sm">
          มีบัญชีแล้ว?{" "}
          <Link to="/login" className="text-indigo-600 hover:underline">เข้าสู่ระบบ</Link>
        </p>
      </form>
    </div>
  );
}
