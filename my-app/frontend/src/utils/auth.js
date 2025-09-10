// src/utils/auth.js

// ===== Config =====
const TOKEN_KEY = "app:token"; // คุณใช้ key นี้อยู่แล้ว

// ===== LocalStorage helpers =====
export function saveToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}
export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

// ===== JWT helpers (parse payload แบบไม่ verify) =====
function parseJwtPayload(token) {
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return json || null;
  } catch {
    return null;
  }
}

export function getPayload() {
  const t = getToken();
  if (!t) return null;
  return parseJwtPayload(t);
}

export function isTokenExpired() {
  const p = getPayload();
  if (!p || !p.exp) return true; // ถ้าไม่มี exp ถือว่าหมดอายุ
  const nowSec = Math.floor(Date.now() / 1000);
  return p.exp <= nowSec;
}

export function isAuthed() {
  const t = getToken();
  if (!t) return false;
  return !isTokenExpired();
}

// ===== Role helpers =====
export function getRole() {
  const p = getPayload();
  let role = p?.role || p?.roles || null;
  if (Array.isArray(role)) role = role[0];
  if (role === "technician") role = "tech"; // map ตามคอนเท็กซ์ของคุณ
  return role || null;
}

export function getDefaultPathByRole(role) {
  switch (role) {
    case "admin":
      return "/admin";
    case "tech":
      return "/tech";
    case "tenant":
      return "/tenant";
    default:
      return "/login";
  }
}
