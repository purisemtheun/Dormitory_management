// frontend/src/app/routes.jsx
import React from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";

import AdminLayout from "../layouts/admin/AdminLayout";
import TenantLayout from "../layouts/tenant/TenantLayout";

// Technician (ถ้ามีไฟล์ตามที่แนะนำ)
import TechnicianLayout from "../layouts/technician/TechnicianLayout";
import TechnicianRepairsPage from "../pages/technician/TechnicianRepairsPage";

import LoginPage from "../pages/auth/LoginPage";
import RegisterPage from "../pages/auth/RegisterPage";

import AdminRoomsManagePage from "../pages/admin/AdminRoomManagePage";
import AdminTenantsManagePage from "../pages/admin/AdminTenantsManagePage";
import AdminInvoiceCreatePage from "../pages/admin/AdminInvoiceCreatePage";
import AdminRepairManagement from "../pages/admin/AdminRepairManagement";

// หน้าอนุมัติการชำระเงินของแอดมิน
import AdminPaymentsPage from "../pages/admin/AdminPaymentsPage";

import RoomInfoPage from "../pages/tenant/RoomInfoPage";
import PaymentPage from "../pages/tenant/PaymentPage";
import TenantRepairCreatePage from "../pages/tenant/TenantRepairCreatePage";

import { getToken, getRole } from "../utils/auth";

/* ============== Guards ============== */
const RequireAuth = ({ children }) =>
  (getToken() ? children : <Navigate to="/login" replace />);

const RequireAdmin = ({ children }) => {
  const role = getRole();
  const ok = role === "admin" || role === "staff";
  return ok ? children : <Navigate to="/login" replace />;
};

// ถ้าคุณยังไม่มี role "technician" ให้คอมเมนต์ guard นี้กับเส้นทาง /technician ชั่วคราวได้
const RequireTechnician = ({ children }) => {
  const role = getRole();
  return role === "technician" ? children : <Navigate to="/login" replace />;
};

/* ============== Router ============== */
const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/login" replace /> },

  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },

  /* ===== Tenant ===== */
  {
    path: "/tenant",
    element: (
      <RequireAuth>
        <TenantLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <RoomInfoPage /> },
      { path: "repairs", element: <TenantRepairCreatePage /> },
      { path: "payments", element: <PaymentPage /> },
    ],
  },

  /* ===== Admin ===== */
  {
    path: "/admin",
    element: (
      <RequireAuth>
        <RequireAdmin>
          <AdminLayout />
        </RequireAdmin>
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="/admin/rooms" replace /> },
      { path: "rooms", element: <AdminRoomsManagePage /> },
      { path: "tenants", element: <AdminTenantsManagePage /> },

      // payments แยก 2 หน้า: ออกใบแจ้งหนี้ / อนุมัติ
      { path: "payments", element: <AdminInvoiceCreatePage /> },
      { path: "payments/approve", element: <AdminPaymentsPage /> },

      { path: "repairs", element: <AdminRepairManagement /> },
    ],
  },

  /* ===== Technician (ช่าง) ===== */
  {
    path: "/technician",
    element: (
      <RequireAuth>
        <RequireTechnician>
          <TechnicianLayout />
        </RequireTechnician>
      </RequireAuth>
    ),
    children: [
      { index: true, element: <TechnicianRepairsPage /> }, // รายการงานซ่อมของช่าง
    ],
  },

  { path: "*", element: <Navigate to="/login" replace /> },
]);

export default router;
