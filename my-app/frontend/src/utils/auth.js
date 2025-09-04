// src/utils/auth.js
const TOKEN_KEY = "app:token"; // ใช้ key เดียวกันทั้งโปรเจกต์

export function saveToken(token) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function clearToken() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
}

export function getPayload() {
  const token = getToken();
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const json = JSON.parse(atob(parts[1]));
    return json || null;
  } catch {
    return null;
  }
}

export function isTokenExpired(skewSec = 30) {
  const p = getPayload();
  if (!p?.exp) return true;
  const now = Math.floor(Date.now() / 1000);
  return p.exp <= now + skewSec; // กัน clock skew
}

export function isAuthed() {
  return !!getToken() && !isTokenExpired();
}

// คืน role สำหรับ frontend routes ให้ตรงกับที่คุณใช้
// backend ส่ง 'admin' | 'tenant' | 'technician'
export function getRole() {
  const role = getPayload()?.role;
  if (!role) return null;
  if (role === "technician") return "tech"; // map ให้ตรง route guard
  return role; // admin | tenant
}

export function getDefaultPathByRole(role = getRole()) {
  if (role === "admin") return "/admin";
  if (role === "tech") return "/tech";
  if (role === "tenant") return "/tenant";
  return "/";
}
