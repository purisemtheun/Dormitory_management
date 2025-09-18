import React from "react";
import { NavLink, Link } from "react-router-dom";

export default function AdminSidebar() {
  return (
    <nav className="ad-nav">
      <Link to="/admin" className="ad-brand">ADMIN</Link>

      <div className="ad-group">
        <div className="ad-label">ภาพรวม</div>
        <NavLink to="/admin" end className={({isActive}) => "ad-link" + (isActive ? " active" : "")}>
          Dashboard
        </NavLink>
      </div>

      <div className="ad-group">
        <div className="ad-label">การจัดการ</div>
        <NavLink to="/admin/rooms" className={({isActive}) => "ad-link" + (isActive ? " active" : "")}>
          ห้องพัก
        </NavLink>
        <NavLink to="/admin/tenants" className={({isActive}) => "ad-link" + (isActive ? " active" : "")}>
          ผู้เช่า
        </NavLink>
      </div>
    </nav>
  );
}
