import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { clearToken } from "../../utils/auth";
import NotificationBell from "../tenant/NotificationBell";

export default function TenantNavbar() {
  const navigate = useNavigate();
  const linkClass = ({ isActive }) => "tn-link" + (isActive ? " active" : "");
  const onLogout = () => { clearToken(); navigate("/login",{replace:true}); };

  return (
    <nav className="tn-navbar">
      <div className="tn-wrap">
        <div className="tn-links" style={{ gap: 18 }}>
          <NavLink to="/tenant" end className="tn-brand">ระบบจัดการหอพัก</NavLink>
          <NavLink to="/tenant" end className={linkClass}>ห้องพัก</NavLink>
          <NavLink to="/tenant/repairs" className={linkClass}>แจ้งซ่อม</NavLink>
          <NavLink to="/tenant/payments" className={linkClass}>ชำระเงิน</NavLink>
        </div>

        <div className="tn-nav-actions">
          <NotificationBell limit={5}/>
          <button className="btn btn-outline" onClick={onLogout}>ออกจากระบบ</button>
        </div>
      </div>
    </nav>
  );
}
