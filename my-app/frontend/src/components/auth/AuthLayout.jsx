import React from "react";
import { Outlet, NavLink } from "react-router-dom";
import { LayoutDashboard, Home, Users, DollarSign, BarChart2, LogOut, Wrench } from "lucide-react";

const MenuLink = ({ to, icon:Icon, label, end }) => (
  <NavLink
    to={to}
    end={end}
    className={({ isActive }) =>
      "flex items-center gap-3 px-4 py-2.5 rounded-xl text-slate-100/90 " +
      "hover:bg-white/5 transition " +
      (isActive ? "bg-white/10 ring-1 ring-white/10" : "")
    }
  >
    <Icon className="w-5 h-5" />
    <span className="font-medium">{label}</span>
  </NavLink>
);

export default function AdminLayout() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <div className="flex min-h-screen">
        {/* Sidebar (ซ้าย) */}
        <aside className="admin-sidebar w-64 shrink-0 text-slate-100">
          <div className="h-full flex flex-col">
            <div className="px-5 pt-5 pb-3">
              <div className="text-2xl font-extrabold">ADMIN</div>
              <div className="text-xs opacity-70">ระบบจัดการหอพัก</div>
            </div>

            <nav className="px-3 space-y-1">
              <div className="px-2 py-1 text-xs uppercase tracking-wider text-white/50">เมนูหลัก</div>
              <MenuLink to="/admin/dashboard"          icon={LayoutDashboard} label="Dashboard" />
              <MenuLink to="/admin/rooms"              icon={Home}           label="จัดการห้องพัก" />
              <MenuLink to="/admin/tenants"            icon={Users}          label="จัดการผู้เช่า" />
              <MenuLink to="/admin/payments"           icon={DollarSign}     label="ออกใบแจ้งหนี้" />
              <MenuLink to="/admin/payments/review"    icon={DollarSign}     label="อนุมัติการชำระเงิน" />
              <MenuLink to="/admin/debts"              icon={DollarSign}     label="ค้นหาหนี้ผู้เช่า" />
              <MenuLink to="/admin/repairs"            icon={Wrench}         label="จัดการงานซ่อม" />
              <MenuLink to="/admin/reports"            icon={BarChart2}      label="รายงานสรุป" />
            </nav>

            <div className="mt-auto p-3">
              <button
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                           bg-white/5 hover:bg-white/10 text-slate-100 transition"
                onClick={() => {
                  localStorage.clear();
                  sessionStorage.clear();
                  window.location.href = "/login";
                }}
              >
                <LogOut className="w-5 h-5" />
                ออกจากระบบ
              </button>
            </div>
          </div>
        </aside>

        {/* Main (ขวา) */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
