import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { isAuthed, getRole, getDefaultPathByRole } from "../utils/auth";

export default function RequireRole({ roles = [], children }) {
  const location = useLocation();

  if (!isAuthed()) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  const role = getRole(); // admin | tenant | tech
  if (!role || (roles.length && !roles.includes(role))) {
    // ถ้า role ไม่ตรง ให้พากลับหน้าหลักของบทบาทนั้น
    return <Navigate to={getDefaultPathByRole(role)} replace />;
  }
  return children;
}
