// src/app/routes.jsx
import { createBrowserRouter, Navigate } from "react-router-dom";

import LoginPage from "../pages/auth/LoginPage.jsx";
import RegisterPage from "../pages/auth/RegisterPage.jsx";

import RequireAuth from "./RequireAuth.jsx";
import RequireRole from "./RequireRole.jsx";

// ถ้ามีไฟล์พวกนี้อยู่แล้ว ใช้ได้เลย; ถ้าไม่มีให้คอมเมนต์ 3 บล็อกด้านล่างทิ้งก่อน
import TenantPage from "../pages/tenant/TenantPage.jsx";
import AdminPage from "../pages/admin/AdminPage.jsx";
import TechPage from "../pages/tech/TechPage.jsx";
import RoomInfoPage  from "../pages/tenant/RoomInfoPage.jsx";

export const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/login" replace /> },

  // public
  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> }, // ถ้าไม่ให้สมัครเอง ลบเส้นนี้ได้

  // protected (คอมเมนต์ 3 บล็อกนี้ได้ ถ้ายังไม่มีไฟล์หน้า dashboard)
  {
    path: "/tenant",
    element: (
      <RequireAuth>
        <RequireRole allow={["tenant"]}>
          <TenantPage />
        </RequireRole>
      </RequireAuth>
    ),
  },
  {
    path: "/admin",
    element: (
      <RequireAuth>
        <RequireRole allow={["admin"]}>
          <AdminPage />
        </RequireRole>
      </RequireAuth>
    ),
  },
  {
    path: "/tech",
    element: (
      <RequireAuth>
        <RequireRole allow={["tech"]}>
          <TechPage />
        </RequireRole>
      </RequireAuth>
    ),
  },
  {
    path: "/tenant/room",
    element: (
        <RequireRole roles={["tenant"]}>
            <RoomInfoPage />
        </RequireRole>
    ),
  },

  // fallback
  { path: "*", element: <Navigate to="/login" replace /> },
]);
