import React from "react";
import { NavLink } from "react-router-dom";

export default function AdminSidebar() {
  return (
    <nav className="ad-nav">
      {/* ไว้ทำทีหลัง */}
      
      <div className="ad-group">
        <div className="ad-label">การจัดการ</div>

        <NavLink
          to="/admin/rooms"
          className={({ isActive }) => "ad-link" + (isActive ? " active" : "")}
        >
          ห้องพัก
        </NavLink>

        {/* ✅ เพิ่มเมนูผู้เช่า */}
        <NavLink
          to="/admin/tenants"
          className={({ isActive }) => "ad-link" + (isActive ? " active" : "")}
        >
          ผู้เช่า
        </NavLink>

        {/* เพิ่มเมนูอื่นภายหลังได้ เช่น แจ้งซ่อม/ช่าง */}
      </div>
    </nav>
  );
}
