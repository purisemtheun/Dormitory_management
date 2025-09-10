// src/app/RequireAuth.jsx
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { isAuthed, isTokenExpired, clearToken } from "../utils/auth";

export default function RequireAuth({ children }) {
  const location = useLocation();

  if (!isAuthed() || isTokenExpired()) {
    clearToken?.();
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
}
