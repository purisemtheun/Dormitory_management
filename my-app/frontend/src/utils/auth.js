// src/utils/auth.js
// ชุด helper สำหรับเก็บ/อ่าน token และดึงข้อมูลจาก JWT payload
// ปรับให้ปลอดภัย: เก็บ token แค่คีย์เดียว ('token') และรองรับ option remember

const TOKEN_KEY = "token";
const MAX_TOKEN_LENGTH = 4000; // ป้องกัน token/ข้อมูลใหญ่ผิดปกติใส่เป็น header

// ----------------- token storage helpers -----------------
/**
 * saveToken(token, { remember: true })
 * - ถ้า remember=true เก็บใน localStorage (ข้าม session)
 * - ถ้า remember=false เก็บใน sessionStorage (จะหายเมื่อปิด tab/browser)
 */
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

    // ลบคีย์เก่าเผื่อมีของโปรเจกต์ก่อนหน้า
    try { localStorage.removeItem("app:token"); } catch (e) {}
    try { localStorage.removeItem("dm_token"); } catch (e) {}
  } catch (e) {
    // silent
  }
}

/**
 * getToken()
 * - คืนค่า token string หรือ null ถ้าไม่มีหรือยาวผิดปกติ
 */
export function getToken() {
  try {
    // อ่านจาก sessionStorage ก่อน (ถ้า user เลือกไม่จำ)
    const s = sessionStorage.getItem(TOKEN_KEY);
    if (s && s.length > 0 && s.length < MAX_TOKEN_LENGTH) return s;

    const l = localStorage.getItem(TOKEN_KEY);
    if (l && l.length > 0 && l.length < MAX_TOKEN_LENGTH) return l;

    // fallback: ในบางโปรเจกต์เก่าอาจมีคีย์อื่น (อ่านแบบ conservative)
    const alt = localStorage.getItem("app:token") || localStorage.getItem("dm_token");
    if (alt && alt.length > 0 && alt.length < MAX_TOKEN_LENGTH) return alt;

    return null;
  } catch (e) {
    return null;
  }
}

/**
 * clearToken()
 * - ลบ token ทุกที่ที่อาจเคยเก็บไว้ (local/session/cookies ที่ไม่ httpOnly)
 */
export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem("app:token");
    localStorage.removeItem("dm_token");
    sessionStorage.removeItem(TOKEN_KEY);

    // ถ้ามี cookie ที่ไม่ httpOnly (ระวังกับ production)
    try {
      document.cookie.split(";").forEach(c => {
        const name = c.split("=")[0].trim();
        if (name) {
          document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
        }
      });
    } catch (e) {}
  } catch (e) {}
}

// ----------------- JWT helpers -----------------
/**
 * parseJwtPayload(token) -> object|null
 * - คืน payload decoded หรือ null ถ้า parse ไม่ได้
 */
function parseJwtPayload(token) {
  try {
    if (!token) return null;
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = parts[1];
    // base64url -> base64
    const b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    // atob may throw if invalid
    const json = decodeURIComponent(
      Array.prototype.map
        .call(atob(b64), c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(json);
  } catch (e) {
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
/**
 * getRole()
 * - อ่านจาก payload field 'role' หรือ 'roles' (รองรับ array / string)
 * - map บาง role ถ้าจำเป็น (ตัวอย่าง: technician -> staff)
 */
export function getRole() {
  const p = getPayload();
  let role = p?.role ?? p?.roles ?? null;
  if (Array.isArray(role)) role = role[0];
  // mapping ตัวอย่าง (ปรับตามโปรเจกต์)
  if (role === "technician") role = "staff";
  return role || null;
}

/**
 * getDefaultPathByRole(role)
 * - คืน path เริ่มต้นสำหรับ role ต่าง ๆ
 */
export function getDefaultPathByRole(role) {
  switch (role) {
    case "admin": return "/admin";
    case "staff": return "/admin";
    case "tenant": return "/tenant";
    default: return "/login";
  }
}
