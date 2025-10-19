// src/utils/auth.js
// ✅ ใช้ค่า env ของ CRA (ต้องขึ้นต้นด้วย REACT_APP_)
const ENV_TOKEN_KEY = process.env.REACT_APP_TOKEN_KEY;
const TOKEN_KEY = (ENV_TOKEN_KEY && ENV_TOKEN_KEY.trim()) || "dm_token"; // fallback
const LEGACY_KEYS = ["token", "app:token", "dm_token"]; // คีย์เก่าที่เคยใช้
const MAX_TOKEN_LENGTH = 4000;

/* ----------------- token storage helpers ----------------- */
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
    // ล้างคีย์เก่า ๆ ให้หมด
    for (const k of LEGACY_KEYS) {
      if (k !== TOKEN_KEY) {
        try { localStorage.removeItem(k); } catch {}
        try { sessionStorage.removeItem(k); } catch {}
      }
    }
  } catch {}
}

export function getToken() {
  try {
    // 1) เอาจาก sessionStorage ก่อน (โหมด remember=false)
    const s = sessionStorage.getItem(TOKEN_KEY);
    if (s && s.length > 0 && s.length < MAX_TOKEN_LENGTH) return s;

    // 2) จาก localStorage
    const l = localStorage.getItem(TOKEN_KEY);
    if (l && l.length > 0 && l.length < MAX_TOKEN_LENGTH) return l;

    // 3) รองรับคีย์เก่า ๆ (เผื่อผู้ใช้ยังค้างอยู่)
    for (const k of LEGACY_KEYS) {
      const v = localStorage.getItem(k) || sessionStorage.getItem(k);
      if (v && v.length > 0 && v.length < MAX_TOKEN_LENGTH) return v;
    }

    return null;
  } catch {
    return null;
  }
}

export function clearToken(opts = { clearCookies: false, cookieNames: [] }) {
  try {
    // ลบคีย์ปัจจุบัน
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);

    // ลบคีย์เก่าด้วย
    for (const k of LEGACY_KEYS) {
      localStorage.removeItem(k);
      sessionStorage.removeItem(k);
    }

    // ลบคุกกี้ที่ระบุชื่อ (ถ้าต้องการ)
    if (opts.clearCookies && Array.isArray(opts.cookieNames)) {
      opts.cookieNames.forEach((name) => {
        try {
          document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
        } catch {}
      });
    }
  } catch {}
}

/* ----------------- JWT helpers ----------------- */
function base64UrlToBase64(b64url) {
  let b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4;
  if (pad === 2) b64 += "==";
  else if (pad === 3) b64 += "=";
  else if (pad !== 0) b64 += "===";
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

/* ----------------- role helpers ----------------- */
export function getRole() {
  const p = getPayload();
  let role = p?.role ?? p?.roles ?? null;
  if (Array.isArray(role)) role = role[0];
  return role || null;
}

export function getDefaultPathByRole(role) {
  switch (role) {
    case "admin":
    case "staff":
      return "/admin";
    case "technician":
      return "/technician";
    case "tenant":
      return "/tenant";
    default:
      return "/login";
  }
}
