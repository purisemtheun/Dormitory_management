// frontend/src/components/nav/TenantNavbar.jsx
import React, { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { clearToken } from "../../utils/auth";
import NotificationBell from "../tenant/NotificationBell";
import http from "../../services/http";

export default function TenantNavbar() {
  const navigate = useNavigate();
  const linkClass = ({ isActive }) => "tn-link" + (isActive ? " active" : "");
  const onLogout = () => { clearToken(); navigate("/login",{replace:true}); };

  // ใช้แค่บอกสถานะ ไม่ได้ซ่อนลิงก์แล้ว
  const [linked, setLinked] = useState(false);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await http.get("/api/line/status"); // { linked:boolean }
        if (mounted) setLinked(!!data?.linked);
      } catch {
        if (mounted) setLinked(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <nav className="tn-navbar">
      <div className="tn-wrap">
        <div className="tn-links" style={{ gap: 18 }}>
          <NavLink to="/tenant" end className="tn-brand">ระบบจัดการหอพัก</NavLink>
          <NavLink to="/tenant" end className={linkClass}>ห้องพัก</NavLink>
          <NavLink to="/tenant/repairs" className={linkClass}>แจ้งซ่อม</NavLink>
          <NavLink to="/tenant/payments" className={linkClass}>ชำระเงิน</NavLink>

          {/* โชว์เสมอ */}
          <NavLink to="/tenant/line/link" className={linkClass}>
            ผูก LINE
            {linked && (
              <span style={{
                marginLeft: 6, fontSize: 10, padding: "2px 6px",
                borderRadius: 999, background: "#ecfdf5", color: "#065f46",
                border: "1px solid rgba(16,185,129,.35)"
              }}>
                ผูกแล้ว
              </span>
            )}
          </NavLink>
        </div>

        <div className="tn-nav-actions">
          <NotificationBell limit={5} />
          <button className="btn btn-outline" onClick={onLogout}>ออกจากระบบ</button>
        </div>
      </div>
    </nav>
  );
}
