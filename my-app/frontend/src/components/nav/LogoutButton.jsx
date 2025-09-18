import React from "react";
import { useNavigate } from "react-router-dom";
import { clearToken } from "../../utils/auth";

export default function LogoutButton({ className = "tn-link" }) {
  const navigate = useNavigate();
  const onLogout = () => {
    clearToken();
    sessionStorage.removeItem("app:tenant:room_id");
    navigate("/login", { replace: true });
  };
  return (
    <button type="button" className={className} onClick={onLogout}>
      ออกจากระบบ
    </button>
  );
}
