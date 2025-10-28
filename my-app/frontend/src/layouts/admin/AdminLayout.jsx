// src/layouts/admin/AdminLayout.jsx
import React from "react";
import { Outlet, NavLink } from "react-router-dom";
import {
  Home, Users, DollarSign, BarChart2, LogOut, LayoutDashboard
} from "lucide-react";

const LinkItem = ({ to, icon: Icon, label, end }) => (
  <NavLink
    to={to}
    end={end}
    className={({ isActive }) =>
      "flex items-center gap-3 px-4 py-3 rounded-lg text-slate-100/90 transition-all duration-200 " +
      (isActive 
        ? "bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/30" 
        : "hover:bg-white/10 hover:text-white")
    }
  >
    <Icon className="w-5 h-5 flex-shrink-0" />
    <span className="font-medium text-sm">{label}</span>
  </NavLink>
);

export default function AdminLayout() {
  const handleLogout = () => {
    if (window.confirm("คุณต้องการออกจากระบบหรือไม่?")) {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch (e) {
        console.error("Clear storage error:", e);
      }
      window.location.href = "/login";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50">
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="admin-sidebar w-72 shrink-0 text-white shadow-2xl">
          <div className="h-full flex flex-col">
            {/* Header */}
            <div className="px-6 py-6 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg">
                  <LayoutDashboard className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xl font-bold">ADMIN</div>
                  <div className="text-xs text-slate-400">ระบบจัดการหอพัก</div>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
              <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                เมนูหลัก
              </div>
              <LinkItem to="/admin/rooms" icon={Home} label="จัดการห้องพัก" end />
              <LinkItem to="/admin/tenants" icon={Users} label="จัดการผู้เช่า" />
              <LinkItem to="/admin/payments" icon={DollarSign} label="การเงิน" />
              <LinkItem to="/admin/reports" icon={BarChart2} label="รายงาน" />
            </nav>

            {/* Logout Button */}
            <div className="p-4 border-t border-white/10">
              <button
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg
                           bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300
                           border border-red-500/20 transition-all duration-200 group"
                onClick={handleLogout}
              >
                <LogOut className="w-5 h-5 group-hover:scale-110 transition-transform" />
                <span className="font-medium">ออกจากระบบ</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0 overflow-auto">
          <div className="max-w-7xl mx-auto px-6 py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}