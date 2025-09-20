import { createBrowserRouter, Navigate } from "react-router-dom";

import LoginPage from "../pages/auth/LoginPage.jsx";
import RegisterPage from "../pages/auth/RegisterPage.jsx";

import RequireAuth from "./RequireAuth.jsx";
import RequireRole from "./RequireRole.jsx";

import TenantPage from "../pages/tenant/TenantPage.jsx";
//import AdminPage from "../pages/admin/AdminPage.jsx";
import TechPage from "../pages/tech/TechPage.jsx";
import RoomInfoPage from "../pages/tenant/RoomInfoPage.jsx";

// Admin layout + pages
import AdminLayout from "../layouts/admin/AdminLayout.jsx";
import AdminRoomsManagePage from "../pages/admin/AdminRoomManagePage.jsx";
import AdminTenantsManagePage from "../pages/admin/AdminTenantsManagePage.jsx";
import TenantRepairCreatePage from "../pages/tenant/TenantRepairCreatePage.jsx";

export const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/login" replace /> },

  // public
  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },

  // dashboards
  {
    path: "/tenant",
    element: (
      <RequireAuth>
        <RequireRole roles={["tenant"]}>
          <TenantPage />
        </RequireRole>
      </RequireAuth>
    ),
  },
  {
    path: "/admin",
    element: (
      <RequireAuth>
        <RequireRole roles={["admin"]}>
          <AdminLayout />
        </RequireRole>
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="rooms" replace /> },
      { path: "rooms", element: <AdminRoomsManagePage /> },
      {
  path: '/admin/tenants',
  element: <AdminTenantsManagePage />
}
    ]
  },
  {
    path: "/tech",
    element: (
      <RequireAuth>
        <RequireRole roles={["technician"]}> {/* ✅ เปลี่ยนจาก "tech" เป็น "technician" */}
          <TechPage />
        </RequireRole>
      </RequireAuth>
    ),
  },

  // tenant – room info
  {
    path: "/tenant/room",
    element: (
      <RequireAuth>
        <RequireRole roles={["tenant"]}>
          <RoomInfoPage />
        </RequireRole>
      </RequireAuth>
    ),
  },

  // tenant – create repair (ฟอร์มแจ้งซ่อม)
  {
    path: "/tenant/repairs",
    element: (
      <RequireAuth>
        <RequireRole roles={["tenant"]}>
          <TenantRepairCreatePage />
        </RequireRole>
      </RequireAuth>
    ),
  },

  // fallback
  { path: "*", element: <Navigate to="/login" replace /> },
]);

export default router;