// frontend/src/components/AdminSidebar.jsx
import React, { useState, useEffect } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import "../styles/admin-sidebar-override.css";


export default function AdminSidebar() {
  const location = useLocation();
  const [paymentsOpen, setPaymentsOpen] = useState(false);

  useEffect(() => {
    // ถ้า path อยู่ใน /admin/payments ให้เปิดเมนูอัตโนมัติ
    if (location.pathname.startsWith("/admin/payments")) {
      setPaymentsOpen(true);
    }
  }, [location.pathname]);

  const linkClass = ({ isActive }) => "ad-link" + (isActive ? " active" : "");

  return (
    <nav className="ad-nav">
      <Link to="/admin" className="ad-brand">ADMIN</Link>

      <div className="ad-group">
        <div className="ad-label">ภาพรวม</div>

        <NavLink to="/admin" end className={linkClass}>Dashboard</NavLink>

        {/* ... other links ... */}

        <div className="ad-section">
          <div
            className="ad-link clickable"
            onClick={() => setPaymentsOpen(v => !v)}
            style={{display: 'flex', justifyContent: 'space-between', alignItems:'center', cursor: 'pointer'}}
          >
            <span>อนุมัติชำระเงิน</span>
            <span style={{transform: paymentsOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .12s'}}>▼</span>
          </div>

          {paymentsOpen && (
            <div className="ad-submenu">
              <NavLink to="/admin/payments" className={({isActive}) => "ad-sublink" + (isActive && location.pathname === "/admin/payments" ? " active" : "")}>
                ✅ อนุมัติการชำระเงิน
              </NavLink>
              <NavLink to="/admin/payments/issue" className={({isActive}) => "ad-sublink" + (isActive ? " active" : "")}>
                🧾 ออกใบแจ้งหนี้
              </NavLink>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
