// src/app/routes.jsx
import React from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";

import AdminLayout from "../layouts/admin/AdminLayout";
import TenantLayout from "../layouts/tenant/TenantLayout";

// Technician
import TechnicianLayout from "../layouts/technician/TechnicianLayout";
import TechnicianRepairsPage from "../pages/technician/TechnicianRepairsPage";

// Auth
import LoginPage from "../pages/auth/LoginPage";
import RegisterPage from "../pages/auth/RegisterPage";

// Admin pages
import AdminRoomManagePage from "../pages/admin/AdminRoomManagePage";
import AdminTenantsManagePage from "../pages/admin/AdminTenantsManagePage";
import AdminInvoiceCreatePage from "../pages/admin/AdminInvoiceCreatePage";
import AdminRepairManagement from "../pages/admin/AdminRepairManagement";
import AdminPaymentsPage from "../pages/admin/AdminPaymentsPage"; // ใช้งานจริงแล้ว!

// Tenant pages
import RoomInfoPage from "../pages/tenant/RoomInfoPage";
import PaymentPage from "../pages/tenant/PaymentPage";
import TenantRepairCreatePage from "../pages/tenant/TenantRepairCreatePage";

import { getToken, getRole } from "../utils/auth";

/* Guards */
const RequireAuth = ({ children }) =>
  (getToken() ? children : <Navigate to="/login" replace />);

const RequireAdmin = ({ children }) => {
  const role = getRole();
  const ok = role === "admin" || role === "staff";
  return ok ? children : <Navigate to="/login" replace />;
};

const RequireTechnician = ({ children }) => {
  const role = getRole();
  return role === "technician" ? children : <Navigate to="/login" replace />;
};

const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/login" replace /> },

  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },

  /* Tenant */
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
    children: [
      { index: true, element: <Navigate to="/admin/rooms" replace /> },
      { path: "rooms", element: <AdminRoomManagePage /> },
      { path: "tenants", element: <AdminTenantsManagePage /> },

      // ✅ ใช้ AdminPaymentsPage เป็นหน้าแม่ และให้ "ออกใบแจ้งหนี้" เป็น subpage
      {
        path: "payments",
        element: <AdminPaymentsPage />,
        children: [
          { path: "issue", element: <AdminInvoiceCreatePage /> },
        ],
      },

      { path: "repairs", element: <AdminRepairManagement /> },
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
    children: [{ index: true, element: <TechnicianRepairsPage /> }],
  },

  { path: "*", element: <Navigate to="/login" replace /> },
]);

export default router;
