// frontend/src/components/nav/TenantNavbar.jsx
import React, { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { clearToken } from "../../utils/auth";
import NotificationBell from "../tenant/NotificationBell";
import http from "../../services/http";

export default function TenantNavbar() {
  const navigate = useNavigate();
  const onLogout = () => { clearToken(); navigate("/login", { replace: true }); };

  const [linked, setLinked] = useState(false);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await http.get("/api/line/status");
        if (mounted) setLinked(!!data?.linked);
      } catch {
        if (mounted) setLinked(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // ฟอนต์ใหญ่ขึ้น + ระยะห่างมากขึ้น
  const linkBase =
    "inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-[16px] sm:text-[17px] font-semibold transition";
  const active = "bg-white text-purple-700 shadow-sm";
  const inactive = "text-white/90 hover:text-white hover:bg-white/10";

  return (
    <nav className="sticky top-0 z-40 bg-purple-700 border-b border-purple-800">
      <div className="max-w-6xl mx-auto px-6 sm:px-8 h-[68px] flex items-center justify-between">
        {/* Brand + links */}
        <div className="flex items-center gap-5 sm:gap-7">
          <NavLink
            to="/tenant"
            end
            className="text-white font-bold text-xl sm:text-2xl tracking-tight"
          >
            ระบบจัดการหอพัก
          </NavLink>

          <div className="hidden md:flex items-center gap-2.5">
            <NavLink to="/tenant" end className={({ isActive }) => linkBase + " " + (isActive ? active : inactive)}>
              ห้องพัก
            </NavLink>
            <NavLink to="/tenant/repairs" className={({ isActive }) => linkBase + " " + (isActive ? active : inactive)}>
              แจ้งซ่อม
            </NavLink>
            <NavLink to="/tenant/payments" className={({ isActive }) => linkBase + " " + (isActive ? active : inactive)}>
              ชำระเงิน
            </NavLink>
            <NavLink to="/tenant/line/link" className={({ isActive }) => linkBase + " " + (isActive ? active : inactive)}>
              ผูก LINE
              {linked && (
                <span className="ml-1 text-[11px] sm:text-[12px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
                  ผูกแล้ว
                </span>
              )}
            </NavLink>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <NotificationBell limit={5} />
          <button
            onClick={onLogout}
            className="px-4 py-2.5 text-[15px] sm:text-[16px] font-semibold rounded-lg border border-white/30 text-white hover:bg-white/10"
          >
            ออกจากระบบ
          </button>
        </div>
      </div>

      {/* mobile links */}
      <div className="md:hidden border-t border-purple-800">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex flex-wrap gap-2">
          <NavLink to="/tenant" end className={({ isActive }) => linkBase + " " + (isActive ? active : inactive)}>ห้องพัก</NavLink>
          <NavLink to="/tenant/repairs" className={({ isActive }) => linkBase + " " + (isActive ? active : inactive)}>แจ้งซ่อม</NavLink>
          <NavLink to="/tenant/payments" className={({ isActive }) => linkBase + " " + (isActive ? active : inactive)}>ชำระเงิน</NavLink>
          <NavLink to="/tenant/line/link" className={({ isActive }) => linkBase + " " + (isActive ? active : inactive)}>
            ผูก LINE
            {linked && <span className="ml-1 text-[11px] sm:text-[12px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">ผูกแล้ว</span>}
          </NavLink>
        </div>
      </div>
    </nav>
  );
}
