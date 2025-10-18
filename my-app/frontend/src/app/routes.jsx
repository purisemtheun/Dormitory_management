// frontend/src/app/routes.jsx
import React from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";

import AdminLayout from "../layouts/admin/AdminLayout";
import TenantLayout from "../layouts/tenant/TenantLayout";
import TechnicianLayout from "../layouts/technician/TechnicianLayout";

// Auth
import LoginPage from "../pages/auth/LoginPage";
import RegisterPage from "../pages/auth/RegisterPage";

// Admin pages
import AdminRoomManagePage from "../pages/admin/AdminRoomManagePage";
import AdminTenantsManagePage from "../pages/admin/AdminTenantsManagePage";
import AdminInvoiceCreatePage from "../pages/admin/AdminInvoiceCreatePage";
import AdminPaymentsPage from "../pages/admin/AdminPaymentsPage";
import AdminRepairManagement from "../pages/admin/AdminRepairManagement";
import AdminDebtSearchPage from "../pages/admin/DebtSearchPage";
import AdminDashboardPage from "../pages/admin/DashboardPage";

// Tenant pages
import RoomInfoPage from "../pages/tenant/RoomInfoPage";
import PaymentPage from "../pages/tenant/PaymentPage";
import TenantRepairCreatePage from "../pages/tenant/TenantRepairCreatePage";
import NotificationCenter from "../pages/tenant/NotificationCenter"; // ✅ แก้พาธ

// Technician page
import TechnicianRepairsPage from "../pages/technician/TechnicianRepairsPage";

import { getToken, getRole } from "../utils/auth";

/* Guards */
const RequireAuth = ({ children }) =>
  getToken() ? children : <Navigate to="/login" replace />;

const RequireAdmin = ({ children }) => {
  const role = getRole();
  return role === "admin" || role === "staff" ? children : <Navigate to="/login" replace />;
};

const RequireTechnician = ({ children }) =>
  getRole() === "technician" ? children : <Navigate to="/login" replace />;

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
      { path: "notifications", element: <NotificationCenter /> }, // ✅ ไม่มี /tenant นำหน้า
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
      { index: true, element: <Navigate to="/admin/dashboard" replace /> },
      { path: "dashboard", element: <AdminDashboardPage /> },
      { path: "rooms", element: <AdminRoomManagePage /> },
      { path: "tenants", element: <AdminTenantsManagePage /> },
      { path: "payments", element: <AdminInvoiceCreatePage /> },
      { path: "payments/review", element: <AdminPaymentsPage /> },
      { path: "repairs", element: <AdminRepairManagement /> },
      { path: "debts", element: <AdminDebtSearchPage /> },
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
