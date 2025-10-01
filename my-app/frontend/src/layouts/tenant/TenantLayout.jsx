import React from "react";
import { Outlet } from "react-router-dom";
import TenantNavbar from "../../components/nav/TenantNavbar";

export default function TenantLayout() {
  return (
    <div className="tn-shell">
      <TenantNavbar />      {/* แสดงแถบบนแค่ที่นี่ */}
      <main className="tn-container">
        <Outlet />
      </main>
    </div>
  );
}
