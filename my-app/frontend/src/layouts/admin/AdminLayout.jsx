// frontend/src/layouts/admin/AdminLayout.jsx
import React, { useEffect, useState } from "react";
import { Outlet, NavLink, Link, useLocation } from "react-router-dom";

/* ===== Sidebar (ประกาศไว้ในไฟล์เดียวกัน) ===== */
function AdminSidebarInline() {
  const location = useLocation();
  const [paymentsOpen, setPaymentsOpen] = useState(false);
  const [repairsOpen, setRepairsOpen] = useState(false);

  useEffect(() => {
    if (location.pathname.startsWith("/admin/payments")) setPaymentsOpen(true);
    if (location.pathname.startsWith("/admin/repairs")) setRepairsOpen(true);
  }, [location.pathname]);

  const COLORS = {
    bg: "#111827",
    text: "#ffffff",
    textSubtle: "rgba(255,255,255,.75)",
    border: "rgba(255,255,255,.10)",
    hover: "rgba(255,255,255,.10)",
    active: "rgba(255,255,255,.16)",
  };

  const S = {
    nav: {
      height: "100%",
      background: COLORS.bg,
      borderRight: `1px solid ${COLORS.border}`,
      padding: 16,
      display: "flex",
      flexDirection: "column",
      gap: 8,
      color: COLORS.text,
    },
    brand: { fontWeight: 800, fontSize: 22, marginBottom: 8, display: "inline-block", color: COLORS.text, textDecoration: "none" },
    label: { marginTop: 12, fontSize: 12, color: COLORS.textSubtle, textTransform: "uppercase" },
    link: { display: "block", padding: "10px 12px", borderRadius: 10, color: COLORS.text, textDecoration: "none", transition: "background .15s ease" },
    linkActive: { background: COLORS.active },
    linkHover: { background: COLORS.hover },
    toggle: {
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "10px 12px", borderRadius: 10, cursor: "pointer", userSelect: "none",
      color: COLORS.text, transition: "background .15s ease",
    },
    subWrap: { display: "flex", flexDirection: "column", gap: 6, paddingLeft: 6 },
    subLink: { display: "block", padding: "8px 10px", borderRadius: 8, textDecoration: "none", color: COLORS.text, transition: "background .15s ease" },
    subActive: { background: COLORS.active },
    subHover: { background: COLORS.hover },
    footer: { marginTop: "auto", paddingTop: 12 },
    logoutBtn: {
      width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${COLORS.border}`,
      background: "transparent", color: COLORS.text, cursor: "pointer", transition: "background .15s ease",
    },
  };

  const LinkItem = ({ to, end, children }) => (
    <NavLink
      to={to}
      end={end}
      style={({ isActive }) => ({ ...S.link, ...(isActive ? S.linkActive : {}) })}
      onMouseEnter={(e) => Object.assign(e.currentTarget.style, S.linkHover)}
      onMouseLeave={(e) => Object.assign(e.currentTarget.style, { background: "transparent" })}
    >
      {children}
    </NavLink>
  );

  const SubLinkItem = ({ to, children }) => (
    <NavLink
      to={to}
      style={({ isActive }) => ({ ...S.subLink, ...(isActive ? S.subActive : {}) })}
      onMouseEnter={(e) => Object.assign(e.currentTarget.style, S.subHover)}
      onMouseLeave={(e) => Object.assign(e.currentTarget.style, { background: "transparent" })}
    >
      {children}
    </NavLink>
  );

  const handleLogout = () => {
    try {
      // เคลียร์ได้ทั้งสองแบบ เพื่อครอบคลุมทุกเคสที่โค้ดอื่นอาจใช้
      localStorage.removeItem("auth");
      localStorage.removeItem("token");
      localStorage.removeItem("role");
      sessionStorage.removeItem("auth");
      sessionStorage.removeItem("token");
      sessionStorage.removeItem("role");
    } catch {}
    window.location.href = "/login";
  };

  return (
    <nav style={S.nav}>
      <Link to="/admin" style={S.brand}>ADMIN</Link>

      <div style={S.label}>ภาพรวม</div>
      <LinkItem to="/admin" end>Dashboard</LinkItem>
      <LinkItem to="/admin/rooms">จัดการห้อง</LinkItem>
      <LinkItem to="/admin/tenants">จัดการผู้เช่า</LinkItem>

      {/* การชำระเงิน */}
      <div
        style={S.toggle}
        onClick={() => setPaymentsOpen(v => !v)}
        onMouseEnter={(e) => Object.assign(e.currentTarget.style, S.linkHover)}
        onMouseLeave={(e) => Object.assign(e.currentTarget.style, { background: "transparent" })}
        aria-expanded={paymentsOpen}
      >
        <span>การชำระเงิน</span>
        <span style={{ transform: paymentsOpen ? "rotate(180deg)" : "rotate(0deg)", transition: ".12s" }}>▼</span>
      </div>
      {paymentsOpen && (
        <div style={S.subWrap}>
          {/* ✅ ชี้ path ให้ตรงกับ routes.jsx */}
          <SubLinkItem to="/admin/payments/review">อนุมัติการชำระเงิน</SubLinkItem>
          <SubLinkItem to="/admin/payments">ออกใบแจ้งหนี้</SubLinkItem>
        </div>
      )}

      {/* งานซ่อม */}
      <div
        style={S.toggle}
        onClick={() => setRepairsOpen(v => !v)}
        onMouseEnter={(e) => Object.assign(e.currentTarget.style, S.linkHover)}
        onMouseLeave={(e) => Object.assign(e.currentTarget.style, { background: "transparent" })}
        aria-expanded={repairsOpen}
      >
        <span>งานซ่อม</span>
        <span style={{ transform: repairsOpen ? "rotate(180deg)" : "rotate(0deg)", transition: ".12s" }}>▼</span>
      </div>
      {repairsOpen && (
        <div style={S.subWrap}>
          <SubLinkItem to="/admin/repairs">จัดการงานซ่อม</SubLinkItem>
        </div>
      )}

      <div style={S.footer}>
        <button
          style={S.logoutBtn}
          onMouseEnter={(e) => (e.currentTarget.style.background = COLORS.hover)}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          onClick={handleLogout}
          aria-label="ออกจากระบบ"
          title="ออกจากระบบ"
        >
          ออกจากระบบ
        </button>
      </div>
    </nav>
  );
}

/* ===== Layout (ห่อ Outlet + ใส่ Sidebar inline) ===== */
export default function AdminLayout() {
  const styles = {
    wrap: { display: "grid", gridTemplateColumns: "260px 1fr", minHeight: "100vh", background: "#ffffff" },
    aside: { background: "#111827" },
    main: { padding: 16 },
  };

  return (
    <div style={styles.wrap}>
      <aside style={styles.aside}>
        <AdminSidebarInline />
      </aside>
      <main style={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
