import React from "react";
import { Link, NavLink } from "react-router-dom";
import LogoutButton from "./LogoutButton";

export default function TenantNavbar() {
  return (
    <header className="tn-navbar">
      <div className="tn-wrap">
        {/* ซ้าย: แบรนด์ + เมนู */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Link to="/tenant" className="tn-brand">ระบบจัดการหอพัก</Link>
          <nav className="tn-links">
            <NavLink
              to="/tenant/room"
              className={({ isActive }) => `tn-link${isActive ? " active" : ""}`}
            >
              ห้องพัก
            </NavLink>
            <NavLink
              to="/tenant/repairs"
              className={({ isActive }) => `tn-link${isActive ? " active" : ""}`}
            >
              แจ้งซ่อม
            </NavLink>
            <NavLink
              to="/tenant/payments"
              className={({ isActive }) => `tn-link${isActive ? " active" : ""}`}
            >
              ชำระเงิน
            </NavLink>
          </nav>
        </div>

        {/* ขวา: Logout */}
        <LogoutButton className="tn-link" />
      </div>
    </header>
  );
}
