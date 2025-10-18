import React from "react";
import { Outlet } from "react-router-dom";
import TenantNavbar from "../../components/nav/TenantNavbar";

export default function TenantLayout() {
  return (
    <div className="tn-layout">
      <TenantNavbar />
      <main className="tn-main">
        <Outlet />
      </main>
    </div>
  );
}
