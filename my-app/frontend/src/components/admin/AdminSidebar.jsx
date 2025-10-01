import React, { useCallback } from "react";
import { NavLink, useNavigate } from "react-router-dom";

export default function AdminSidebar() {
  const navigate = useNavigate();

  const onLogout = useCallback(() => {
    try {
      localStorage.removeItem("token");
      sessionStorage.removeItem("token");
      localStorage.removeItem("auth_user");
    } catch {}
    navigate("/login", { replace: true });
  }, [navigate]);

  return (
    // ทำให้ sidebar เป็นคอลัมน์ เต็มความสูง แล้วค่อยดันปุ่มลงล่างด้วย marginTop: 'auto'
    <nav className="ad-nav" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="ad-group">
        <div className="ad-label">การจัดการ</div>

        <NavLink
          to="/admin/rooms"
          className={({ isActive }) => "ad-link" + (isActive ? " active" : "")}
        >
          ห้องพัก
        </NavLink>

        <NavLink
          to="/admin/tenants"
          className={({ isActive }) => "ad-link" + (isActive ? " active" : "")}
        >
          บันทึกผู้เช่า
        </NavLink>

        {/* เพิ่มเมนูอื่น ๆ ได้ตรงนี้ในอนาคต */}
      </div>

      {/* ปุ่มออกจากระบบ: อยู่ล่างสุดเสมอ + พื้นหลังขาว ตัวอักษรดำ */}
      <div className="ad-group" style={{ marginTop: "auto" }}>
        <button
          type="button"
          onClick={onLogout}
          style={{
            width: "100%",
            textAlign: "left",
            background: "#ffffff",
            color: "#000000",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            padding: "10px 12px",
            cursor: "pointer",
          }}
        >
          ออกจากระบบ
        </button>
      </div>
    </nav>
  );
}
