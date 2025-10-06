// frontend/src/app/routes.jsx
import React from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";

import AdminLayout from "../layouts/admin/AdminLayout";
import TenantLayout from "../layouts/tenant/TenantLayout";

import LoginPage from "../pages/auth/LoginPage";
import RegisterPage from "../pages/auth/RegisterPage";

import AdminRoomsManagePage from "../pages/admin/AdminRoomManagePage";
import AdminTenantsManagePage from "../pages/admin/AdminTenantsManagePage";
import AdminPaymentsPage from "../pages/admin/AdminPaymentsPage";
import AdminInvoiceCreatePage from "../pages/admin/AdminInvoiceCreatePage"; // <-- เพิ่มนำเข้า

import RoomInfoPage from "../pages/tenant/RoomInfoPage";
import PaymentPage from "../pages/tenant/PaymentPage";
import TenantRepairCreatePage from "../pages/tenant/TenantRepairCreatePage";

import { getToken, getRole } from "../utils/auth";

const RequireAuth = ({ children }) =>
  (getToken() ? children : <Navigate to="/login" replace />);

const RequireAdmin = ({ children }) => {
  const role = getRole();
  const ok = role === "admin" || role === "staff";
  return ok ? children : <Navigate to="/login" replace />;
};

const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/login" replace /> },

  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },

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

      // payments เป็น parent route ที่มี child route "issue"
      {
        path: "payments",
        element: <AdminPaymentsPage />,
        children: [
          { path: "issue", element: <AdminInvoiceCreatePage /> }, // /admin/payments/issue
        ],
      },

      // (ไม่ต้องเพิ่ม /admin/payments/issue เดียวอีกทีข้างนอก)
    ],
  },

  { path: "*", element: <Navigate to="/login" replace /> },
]);

export default router;
