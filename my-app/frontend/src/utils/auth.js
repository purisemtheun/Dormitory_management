// src/utils/auth.js
const TOKEN_KEY = "token";
const MAX_TOKEN_LENGTH = 4000;

// ----------------- token storage helpers -----------------
export function saveToken(token, opts = { remember: true }) {
  if (!token) return;
  try {
    if (opts.remember) {
      localStorage.setItem(TOKEN_KEY, token);
      sessionStorage.removeItem(TOKEN_KEY);
    } else {
      sessionStorage.setItem(TOKEN_KEY, token);
      localStorage.removeItem(TOKEN_KEY);
    }
    // cleanup legacy keys
    try { localStorage.removeItem("app:token"); } catch {}
    try { localStorage.removeItem("dm_token"); } catch {}
  } catch {}
}

export function getToken() {
  try {
    const s = sessionStorage.getItem(TOKEN_KEY);
    if (s && s.length > 0 && s.length < MAX_TOKEN_LENGTH) return s;

    const l = localStorage.getItem(TOKEN_KEY);
    if (l && l.length > 0 && l.length < MAX_TOKEN_LENGTH) return l;

    const alt = localStorage.getItem("app:token") || localStorage.getItem("dm_token");
    if (alt && alt.length > 0 && alt.length < MAX_TOKEN_LENGTH) return alt;

    return null;
  } catch {
    return null;
  }
}

export function clearToken(opts = { clearCookies: false, cookieNames: [] }) {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem("app:token");
    localStorage.removeItem("dm_token");
    sessionStorage.removeItem(TOKEN_KEY);

    // ลบเฉพาะคุกกี้ที่ระบุชื่อเท่านั้น (ปลอดภัยกว่า)
    if (opts.clearCookies && Array.isArray(opts.cookieNames)) {
      opts.cookieNames.forEach((name) => {
        try {
          document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
        } catch {}
      });
    }
  } catch {}
}

// ----------------- JWT helpers -----------------
function base64UrlToBase64(b64url) {
  let b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  // เติม padding ให้ครบพหุคูณ 4
  const pad = b64.length % 4;
  if (pad === 2) b64 += "==";
  else if (pad === 3) b64 += "=";
  else if (pad !== 0) b64 += "==="; // กัน edge case
  return b64;
}

function parseJwtPayload(token) {
  try {
    if (!token) return null;
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const b64 = base64UrlToBase64(parts[1]);
    const json = decodeURIComponent(
      Array.prototype.map
        .call(atob(b64), (c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function getPayload() {
  const t = getToken();
  return t ? parseJwtPayload(t) : null;
}

export function isTokenExpired() {
  const p = getPayload();
  if (!p || typeof p !== "object") return true;
  if (!p.exp) return true;
  const now = Math.floor(Date.now() / 1000);
  return p.exp <= now;
}

export function isAuthed() {
  const t = getToken();
  return !!t && !isTokenExpired();
}

// ----------------- role helpers -----------------
export function getRole() {
  const p = getPayload();
  let role = p?.role ?? p?.roles ?? null;
  if (Array.isArray(role)) role = role[0];

  // ❌ อย่า map technician → staff ถ้ามีเส้นทาง /technician จริง
  // ถ้าจำเป็นต้อง map ให้ทำใน guard/route ที่ต้องการเท่านั้น

  return role || null;
}

export function getDefaultPathByRole(role) {
  switch (role) {
    case "admin":
    case "staff":
      return "/admin";
    case "technician":
      return "/technician"; // ✅ รองรับหน้า technician แล้ว
    case "tenant":
      return "/tenant";
    default:
      return "/login";
  }
}
