import React from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";

// layouts
import AdminLayout from "../layouts/admin/AdminLayout";
import TenantLayout from "../layouts/tenant/TenantLayout";

// pages (auth)
import LoginPage from "../pages/auth/LoginPage";
import RegisterPage from "../pages/auth/RegisterPage";

// pages (admin)
import AdminRoomsManagePage from "../pages/admin/AdminRoomManagePage";
import AdminTenantsManagePage from "../pages/admin/AdminTenantsManagePage";
import AdminPaymentsPage from "../pages/admin/AdminPaymentsPage";

// pages (tenant)
import RoomInfoPage from "../pages/tenant/RoomInfoPage";
import PaymentPage from "../pages/tenant/PaymentPage";
import TenantRepairCreatePage from "../pages/tenant/TenantRepairCreatePage";

import { getToken } from "../utils/auth";

const RequireAuth = ({ children }) =>
  (getToken() ? children : <Navigate to="/login" replace />);

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
        <AdminLayout />
      </RequireAuth>
    ),
    children: [
      // 👉 ทำให้กด /admin แล้วมีหน้าเริ่มต้น (เปลี่ยนเป้าหมายได้ตามต้องการ)
      { index: true, element: <Navigate to="/admin/rooms" replace /> },

      { path: "rooms", element: <AdminRoomsManagePage /> },
      { path: "tenants", element: <AdminTenantsManagePage /> },
      { path: "payments", element: <AdminPaymentsPage /> },
    ],
  },

  { path: "*", element: <Navigate to="/login" replace /> },
]);

export default router;
