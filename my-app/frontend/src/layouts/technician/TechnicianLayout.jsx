// frontend/src/layouts/technician/TechnicianLayout.jsx
import React from "react";
import { Outlet, Link } from "react-router-dom";

export default function TechnicianLayout() {
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Technician</h2>
        <nav style={{ marginLeft: "auto", display: "flex", gap: 12 }}>
          <Link to="/technician">งานของฉัน</Link>
        </nav>
      </header>
      <Outlet />
    </div>
  );
}
