// src/app/routes.jsx
import React, { Suspense, lazy } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";

import AdminLayout from "../layouts/admin/AdminLayout";
import TenantLayout from "../layouts/tenant/TenantLayout";
import TechnicianLayout from "../layouts/technician/TechnicianLayout";

// Auth
import LoginPage from "../pages/auth/LoginPage";
import RegisterPage from "../pages/auth/RegisterPage";

// Admin pages (โหลดตรง)
import AdminRoomManagePage from "../pages/admin/AdminRoomManagePage";
import AdminTenantsManagePage from "../pages/admin/AdminTenantsManagePage";
import AdminInvoiceCreatePage from "../pages/admin/AdminInvoiceCreatePage";
import AdminPaymentsPage from "../pages/admin/AdminPaymentsPage";
import AdminRepairManagement from "../pages/admin/AdminRepairManagement";
import AdminDebtSearchPage from "../pages/admin/DebtSearchPage";
import AdminDashboardPage from "../pages/admin/DashboardPage";
/* ✅ NEW: import หน้าสำหรับอนุมัติการจองห้อง */
import AdminRoomReservationsPage from "../pages/admin/AdminRoomReservationsPage";

// Tenant pages
import RoomInfoPage from "../pages/tenant/RoomInfoPage";
import PaymentPage from "../pages/tenant/PaymentPage";
import TenantRepairCreatePage from "../pages/tenant/TenantRepairCreatePage";
import NotificationCenter from "../pages/tenant/NotificationCenter";
import LineLinkPage from "../pages/tenant/LineLinkPage";

// Technician page
import TechnicianRepairsPage from "../pages/technician/TechnicianRepairsPage";

import { getToken, getRole } from "../utils/auth";
import RouteError from "../components/common/RouteError";

/* ✅ หลังจบ import ทั้งหมด ค่อยประกาศ lazy component */
const AdminReportsPage = lazy(() => import("../pages/admin/AdminReportsPage"));

/* Guards (ห้ามเป็น async component) */
const RequireAuth = ({ children }) =>
  getToken() ? children : <Navigate to="/login" replace />;

const RequireAdmin = ({ children }) => {
  const role = getRole();
  return role === "admin" || role === "staff" ? children : <Navigate to="/login" replace />;
};

const RequireTechnician = ({ children }) =>
  getRole() === "technician" ? children : <Navigate to="/login" replace />;

const withSuspense = (el) => (
  <Suspense fallback={<div style={{ padding: 16 }}>Loading…</div>}>
    {el}
  </Suspense>
);

const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/login" replace />, errorElement: <RouteError /> },
  { path: "/login", element: <LoginPage />, errorElement: <RouteError /> },
  { path: "/register", element: <RegisterPage />, errorElement: <RouteError /> },

  /* Tenant */
  {
    path: "/tenant",
    element: (
      <RequireAuth>
        <TenantLayout />
      </RequireAuth>
    ),
    errorElement: <RouteError />,
    children: [
      { index: true, element: <RoomInfoPage /> },
      { path: "repairs", element: <TenantRepairCreatePage /> },
      { path: "payments", element: <PaymentPage /> },
      { path: "notifications", element: <NotificationCenter /> },
      { path: "line/link", element: <LineLinkPage /> },
    ],
  },

  /* Admin */
  {
    path: "/admin",
    element: (
      <RequireAuth>
        <RequireAdmin>
          <AdminLayout />
        </RequireAdmin>
      </RequireAuth>
    ),
    errorElement: <RouteError />,
    children: [
      { index: true, element: <Navigate to="/admin/dashboard" replace /> },
      { path: "dashboard", element: <AdminDashboardPage /> },
      { path: "rooms", element: <AdminRoomManagePage /> },
      /* ✅ NEW: หน้าย่อยของจัดการห้องพัก: อนุมัติการจอง */
      { path: "rooms/reservations", element: <AdminRoomReservationsPage /> },
      { path: "tenants", element: <AdminTenantsManagePage /> },
      { path: "payments", element: <AdminInvoiceCreatePage /> },     // ออกบิล
      { path: "payments/review", element: <AdminPaymentsPage /> },    // อนุมัติ/ปฏิเสธ
      { path: "repairs", element: <AdminRepairManagement /> },
      { path: "debts", element: <AdminDebtSearchPage /> },
      { path: "reports", element: withSuspense(<AdminReportsPage />) }, // ใช้ Suspense
    ],
  },

  /* Technician */
  {
    path: "/technician",
    element: (
      <RequireAuth>
        <RequireTechnician>
          <TechnicianLayout />
        </RequireTechnician>
      </RequireAuth>
    ),
    errorElement: <RouteError />,
    children: [{ index: true, element: <TechnicianRepairsPage /> }],
  },

  { path: "*", element: <Navigate to="/login" replace />, errorElement: <RouteError /> },
]);

export default router;
