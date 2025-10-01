import React from "react";
import { Outlet } from "react-router-dom";
import AdminSidebar from "../../components/admin/AdminSidebar";

console.log("AdminSidebar loaded");
export default function AdminLayout() {
  return (
    <div className="ad-shell">
      <div className="ad-wrap">
        <aside className="ad-sidebar">
          <AdminSidebar />
        </aside>
        <main className="ad-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
