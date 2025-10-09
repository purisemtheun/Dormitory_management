import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { clearToken } from "../../utils/auth";

export default function TenantNavbar() {
  const navigate = useNavigate();
  const linkClass = ({ isActive }) => "tn-link" + (isActive ? " active" : "");

  const onLogout = () => {
    clearToken();
    navigate("/login", { replace: true });
  };

  return (
    <nav className="tn-navbar">
      <div className="tn-wrap">
        {/* ซ้าย: แบรนด์ + เมนู (ใช้คลาสเดิมทั้งหมด) */}
        <div className="tn-links" style={{ gap: 18 }}>
          <NavLink to="/tenant" end className="tn-brand">
            ระบบจัดการหอพัก
          </NavLink>
          <NavLink to="/tenant" end className={linkClass}>
            ห้องพัก
          </NavLink>
          <NavLink to="/tenant/repairs" className={linkClass}>
            แจ้งซ่อม
          </NavLink>
          <NavLink to="/tenant/payments" className={linkClass}>
            ชำระเงิน
          </NavLink>
          <NavLink to="/tenant/notifications">แจ้งเตือน</NavLink>

        </div>

        {/* ขวา: ปุ่มออกจากระบบ (ใช้ .btn-outline เดิมของคุณ) */}
        <div>
          <button className="btn btn-outline" onClick={onLogout}>
            ออกจากระบบ
          </button>
        </div>
      </div>
    </nav>
  );
}
