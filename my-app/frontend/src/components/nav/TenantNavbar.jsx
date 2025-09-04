import React from "react";
import { Link, NavLink } from "react-router-dom";

export default function TenantNavbar() {
  return (
    <header className="tn-navbar">
      <div className="tn-wrap">
        <Link to="/tenant" className="tn-brand">ระบบจัดการหอพัก</Link>
        <nav className="tn-links">
          <NavLink to="/tenant/room" className="tn-link">ข้อมูลห้องพัก</NavLink>
          <NavLink to="/tenant/repairs" className="tn-link">แจ้งซ่อม/ประวัติ</NavLink>
          <NavLink to="/tenant/payments" className="tn-link">ข้อมูลชำระเงิน</NavLink>
        </nav>
      </div>
    </header>
  );
}
