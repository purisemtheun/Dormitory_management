// src/layouts/admin/AdminLayout.jsx
import React, { useMemo, useState, useEffect } from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import {
  Home,
  Users,
  DollarSign,
  BarChart2,
  LogOut,
  LayoutDashboard,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  Search,
  Receipt,
  Wrench, // 🔧 ไอคอนเมนูแจ้งซ่อม
} from "lucide-react";

/* ===== Reusable Link item ===== */
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

/* ===== Finance dropdown group ===== */
function FinanceGroup() {
  const location = useLocation();

  const items = useMemo(
    () => [
      // ✅ เพิ่ม end:true ให้ตัวที่เป็น prefix ของตัวอื่น
      { to: "/admin/payments",        label: "ออกใบแจ้งหนี้",  icon: Receipt,     end: true },
      { to: "/admin/payments/review", label: "อนุมัติชำระเงิน", icon: CheckCircle, end: false },
      { to: "/admin/debts",           label: "ค้นหาหนี้",        icon: Search,      end: false },
    ],
    []
  );

  const isOnFinance =
    location.pathname.startsWith("/admin/payments") ||
    location.pathname.startsWith("/admin/debts");

  const [open, setOpen] = useState(isOnFinance);
  useEffect(() => { if (isOnFinance) setOpen(true); }, [isOnFinance]);

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={
          "w-full flex items-center justify-between px-4 py-3 rounded-lg text-slate-100/90 " +
          "hover:bg-white/10 hover:text-white transition-all duration-200"
        }
        aria-expanded={open}
      >
        <span className="flex items-center gap-3">
          <span className="inline-flex w-5 h-5 items-center justify-center">
            <DollarSign className="w-5 h-5" />
          </span>
          <span className="font-medium text-sm">การเงิน</span>
        </span>
        {open ? <ChevronDown className="w-4 h-4 opacity-80" /> : <ChevronRight className="w-4 h-4 opacity-80" />}
      </button>

      <div className={"overflow-hidden transition-all duration-200 " + (open ? "max-h-96 opacity-100" : "max-h-0 opacity-0")}>
        <div className="mt-1 ml-2 pl-2 border-l border-white/10 space-y-1">
          {items.map(({ to, label, icon: Icon, end }, idx) => (
            <NavLink
              key={idx}
              to={to}
              end={end}
              className={({ isActive }) =>
                "flex items-center gap-2 px-4 py-2 rounded-md text-sm " +
                (isActive
                  ? "bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/30"
                  : "text-slate-200/90 hover:bg-white/5 hover:text-white")
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </div>
    </div>
  );
}


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
        <aside className="admin-sidebar w-72 shrink-0 text-white shadow-2xl bg-slate-900/95">
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

              {/* ✅ Dashboard (index /admin) */}
              <LinkItem to="/admin" icon={LayoutDashboard} label="แดชบอร์ด" end />

              <LinkItem to="/admin/rooms"   icon={Home}   label="จัดการห้องพัก" end />
              <LinkItem to="/admin/tenants" icon={Users}  label="จัดการผู้เช่า" />

              {/* ✅ Repairs management */}
              <LinkItem to="/admin/repairs" icon={Wrench} label="การจัดการแจ้งซ่อม" />

              {/* ▼ กลุ่มเมนูย่อยการเงิน */}
              <FinanceGroup />

              <LinkItem to="/admin/reports" icon={BarChart2} label="รายงาน" />
            </nav>

            {/* Logout */}
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
