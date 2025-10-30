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

  // *** ปรับปรุงขนาดลิงก์: ฟอนต์ใหญ่ขึ้น + ระยะห่างมากขึ้น (ปรับเป็น px-5 py-3 และ text-lg) ***
  const linkBase =
    "inline-flex items-center gap-2 px-5 py-3 rounded-xl text-lg font-semibold transition duration-150";
  // ปรับสี Active ให้เด่นชัดและดูสะอาดตาขึ้น
  const active = "bg-white text-purple-700 shadow-lg shadow-purple-900/10";
  const inactive = "text-white/90 hover:text-white hover:bg-white/10";

  return (
    // *** ปรับความสูง Navbar (h-20 จาก h-[68px]) ***
    <nav className="sticky top-0 z-40 bg-purple-700 border-b border-purple-800">
      <div className="max-w-6xl mx-auto px-6 sm:px-8 h-20 flex items-center justify-between">
        {/* Brand + links */}
        <div className="flex items-center gap-5 sm:gap-10"> {/* เพิ่ม gap ให้ห่างขึ้น */}
          <NavLink
            to="/tenant"
            end
            // *** เพิ่มขนาด Brand เป็น text-2xl/3xl ***
            className="text-white font-black text-2xl sm:text-3xl tracking-tight"
          >
            ระบบจัดการหอพัก
          </NavLink>

          {/* *** เพิ่ม gap-3 ให้ลิงก์นำทาง (จาก gap-2.5) *** */}
          <div className="hidden md:flex items-center gap-3">
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
                // ปรับขนาด Badge ให้ใหญ่ขึ้นเล็กน้อย (text-xs จาก text-[11px])
                <span className="ml-1 text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold ring-1 ring-emerald-200">
                  ผูกแล้ว
                </span>
              )}
            </NavLink>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-4"> {/* เพิ่ม gap เป็น 4 */}
          <NotificationBell limit={5} />
          <button
            onClick={onLogout}
            // *** ปรับขนาดปุ่มออกจากระบบ (px-5 py-3 และ text-lg) ***
            className="px-5 py-3 text-lg font-semibold rounded-xl border border-white/30 text-white hover:bg-white/10 transition duration-150"
          >
            ออกจากระบบ
          </button>
        </div>
      </div>

      {/* mobile links */}
      <div className="md:hidden border-t border-purple-800">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap gap-2"> {/* เพิ่ม py เป็น 3 */}
          <NavLink to="/tenant" end className={({ isActive }) => linkBase + " " + (isActive ? active : inactive)}>ห้องพัก</NavLink>
          <NavLink to="/tenant/repairs" className={({ isActive }) => linkBase + " " + (isActive ? active : inactive)}>แจ้งซ่อม</NavLink>
          <NavLink to="/tenant/payments" className={({ isActive }) => linkBase + " " + (isActive ? active : inactive)}>ชำระเงิน</NavLink>
          <NavLink to="/tenant/line/link" className={({ isActive }) => linkBase + " " + (isActive ? active : inactive)}>
            ผูก LINE
            {linked && <span className="ml-1 text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold ring-1 ring-emerald-200">ผูกแล้ว</span>}
          </NavLink>
        </div>
      </div>
    </nav>
  );
}