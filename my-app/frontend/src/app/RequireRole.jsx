// src/app/RequireRole.jsx
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { isAuthed, getRole, getDefaultPathByRole } from "../utils/auth";

export default function RequireRole({ roles = [], allow, children }) {
  const location = useLocation();

  if (!isAuthed()) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  // รองรับได้ทั้ง roles และ allow
  const allowList = Array.isArray(allow) ? allow : allow ? [allow] : roles;
  const role = getRole?.();

  if (!role) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (allowList.length && !allowList.includes(role)) {
    const fallback = getDefaultPathByRole?.(role) || "/login";
    return <Navigate to={fallback} replace />;
  }
  return children;
}
