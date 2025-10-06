import React, { useState, useEffect } from "react";
import { NavLink, Link, useLocation, useNavigate } from "react-router-dom";

export default function AdminSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [paymentsOpen, setPaymentsOpen] = useState(false);

  useEffect(() => {
    // ถ้า path อยู่ใน /admin/payments ให้เปิดเมนูอัตโนมัติ
    if (location.pathname.startsWith("/admin/payments")) {
      setPaymentsOpen(true);
    }
  }, [location.pathname]);

  const linkClass = ({ isActive }) => "ad-link" + (isActive ? " active" : "");

  const handleLogout = () => {
    // ลบ token / session (ปรับ key ตามโปรเจกต์ของคุณได้)
    try {
      localStorage.removeItem("token");
      sessionStorage.removeItem("token");
      // ถ้ามี util สำหรับ logout ให้เรียกที่นั่นแทน
    } catch (e) {
      console.warn("Logout cleanup:", e);
    }
    navigate("/login", { replace: true });
  };

  return (
    <nav className="ad-nav" style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <div>
        <Link to="/admin" className="ad-brand" style={{ display: "block", padding: 12 }}>ADMIN</Link>

        <div className="ad-group" style={{ padding: 8 }}>
          <div className="ad-label" style={{ padding: "8px 10px", color: "#94a3b8" }}>ภาพรวม</div>

          <NavLink to="/admin" end className={linkClass} style={{ display: "block", padding: "8px 10px", textDecoration: "none" }}>
            Dashboard
          </NavLink>

          {/* ตัวอย่างลิงก์อื่น ๆ */}
          <NavLink to="/admin/rooms" className={linkClass} style={{ display: "block", padding: "8px 10px", textDecoration: "none" }}>
            จัดการห้อง
          </NavLink>

          <NavLink to="/admin/tenants" className={linkClass} style={{ display: "block", padding: "8px 10px", textDecoration: "none" }}>
            จัดการผู้เช่า
          </NavLink>

          {/* อนุมัติชำระเงิน - มี dropdown ย่อย */}
          <div className="ad-section" style={{ marginTop: 8 }}>
            <div
              className="ad-link clickable"
              onClick={() => setPaymentsOpen(v => !v)}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", cursor: "pointer" }}
            >
              <span>อนุมัติชำระเงิน</span>
              <span style={{ transform: paymentsOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform .12s" }}>▼</span>
            </div>

            {paymentsOpen && (
              <div className="ad-submenu" style={{ paddingLeft: 8, marginTop: 8 }}>
                <NavLink
                  to="/admin/payments"
                  className={({ isActive }) => "ad-sublink" + (isActive && location.pathname === "/admin/payments" ? " active" : "")}
                  style={{ display: "block", padding: "6px 10px", borderRadius: 6, textDecoration: "none" }}
                >
                  ✅ อนุมัติการชำระเงิน
                </NavLink>

                {/* <-- อยู่ในส่วนย่อยของอนุมัติชำระเงินจริงๆ */}
                <NavLink
                  to="/admin/payments/issue"
                  className={({ isActive }) => "ad-sublink" + (isActive ? " active" : "")}
                  style={{ display: "block", padding: "6px 10px", borderRadius: 6, textDecoration: "none", marginTop: 6 }}
                >
                  🧾 ออกใบแจ้งหนี้
                </NavLink>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer ของ sidebar: logout */}
      <div style={{ marginTop: "auto", padding: 12 }}>
        <button
          onClick={handleLogout}
          className="btn btn-logout"
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid rgba(0,0,0,0.06)",
            background: "#fff",
            cursor: "pointer"
          }}
        >
          ออกจากระบบ
        </button>
      </div>
    </nav>
  );
}
