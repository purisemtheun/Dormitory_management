// src/app/routes.jsx
import { createBrowserRouter, Navigate } from "react-router-dom";

import LoginPage from "../pages/auth/LoginPage.jsx";
import RegisterPage from "../pages/auth/RegisterPage.jsx";

import RequireAuth from "./RequireAuth.jsx";
import RequireRole from "./RequireRole.jsx";

// ถ้ามีไฟล์พวกนี้อยู่แล้ว ใช้ได้เลย; ถ้าไม่มีให้คอมเมนต์ทิ้ง
import TenantPage from "../pages/tenant/TenantPage.jsx";
import AdminPage from "../pages/admin/AdminPage.jsx";
import TechPage from "../pages/tech/TechPage.jsx";
import RoomInfoPage from "../pages/tenant/RoomInfoPage.jsx";

// ใช้ชื่อไฟล์ที่คุณมีจริง
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
          <AdminPage />
        </RequireRole>
      </RequireAuth>
    ),
  },
  {
    path: "/tech",
    element: (
      <RequireAuth>
        <RequireRole roles={["tech"]}>
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
