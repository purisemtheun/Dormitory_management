import React from "react";
import { Outlet, Link } from "react-router-dom";

export default function TechnicianLayout() {
  const handleLogout = () => {
    try {
      localStorage.removeItem("token");
      localStorage.removeItem("role");
      sessionStorage.removeItem("token");
      sessionStorage.removeItem("role");
    } catch {}
    window.location.href = "/login";
  };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <h2 style={{ margin: 0 }}>Technician</h2>

        <nav style={{ marginLeft: "auto", display: "flex", gap: 12 }}>
          <Link to="/technician">งานของฉัน</Link>

          {/* ปุ่มออกจากระบบ */}
          <button
            onClick={handleLogout}
            title="ออกจากระบบ"
            aria-label="ออกจากระบบ"
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              background: "#fff",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#f9fafb")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
          >
            ออกจากระบบ
          </button>
        </nav>
      </header>
      <Outlet />
    </div>
  );
}
