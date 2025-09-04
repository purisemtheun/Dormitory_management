// src/services/auth.api.js
import http from "./http";

export async function loginApi({ email, password }) {
  const { data } = await http.post("/api/auth/login", { email, password });
  return data; // { token, user }
}

export async function registerApi({ name, email, phone, password, role }) {
  const { data } = await http.post("/api/auth/register", {
    name, email, phone, password, role,   // ✅ ส่ง role ตรง ๆ
  });
  return data;
}
