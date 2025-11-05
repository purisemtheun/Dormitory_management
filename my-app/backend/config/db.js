// backend/config/db.js
"use strict";
const fs = require("fs");
const mysql = require("mysql2/promise");

/* =========================
 * SSL helper (Aiven / Render)
 * ========================= */
function useSSL() {
  const on = String(process.env.DB_SSL || "").toLowerCase();
  if (on === "1" || on === "true" || on === "yes") return true;
  return false;
}
function buildSSL() {
  if (!useSSL()) return undefined;

  // 1) วางเนื้อหา CA ลง ENV โดยตรง (รองรับ \n)
  if (process.env.DB_SSL_CA) {
    const ca = process.env.DB_SSL_CA.replace(/\\n/g, "\n");
    return { ca };
  }

  // 2) วางแบบ base64
  if (process.env.DB_SSL_CA_B64) {
    const ca = Buffer.from(process.env.DB_SSL_CA_B64, "base64").toString("utf8");
    return { ca };
  }

  // 3) ใช้ไฟล์บนเครื่อง (เหมาะตอนรัน dev บนเครื่องเรา)
  const file = process.env.DB_SSL_CA_FILE;
  if (file && typeof file === "string") {
    try {
      const ca = fs.readFileSync(file, "utf8");
      return { ca };
    } catch (e) {
      console.warn("[DB] Cannot read DB_SSL_CA_FILE:", file, e.message);
    }
  }

  // ถ้าเปิด DB_SSL แต่ไม่มี CA ให้คืน object เปล่า (บางผู้ให้บริการรับได้)
  return {};
}

/* =========================
 * MySQL pool
 * ========================= */
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_POOL || 10),
  ssl: buildSSL(),

  // ให้แน่ใจว่า UTF-8 เต็ม
  charset: "utf8mb4",
  supportBigNumbers: true,
  dateStrings: true, // ให้วันที่ออกมาเป็น string (อ่านง่าย/กัน timezone shift)
});

/* =========================
 * Prepare session per-connection
 * ========================= */
async function prepareSession(conn) {
  // บังคับ charset/collation ในระดับ session
  await conn.query("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
  await conn.query("SET collation_connection = 'utf8mb4_unicode_ci'");

  // ตั้ง timezone (ใช้รูปแบบ '+07:00' จะปลอดภัยสุดกับ MySQL)
  const tz = process.env.APP_TZ || process.env.TZ;
  if (tz) {
    // ถ้าผู้ใช้ส่ง "Asia/Bangkok" เราจะแปลงเป็น offset แบบ +07:00 ให้
    const isOffset = /^[+-]\d{2}:\d{2}$/.test(tz);
    const offset = isOffset ? tz : "+07:00";
    await conn.query("SET time_zone = ?", [offset]);
  }
}

// patch getConnection ให้เตรียม session ทุกครั้ง
const origGetConn = pool.getConnection.bind(pool);
pool.getConnection = async function patchedGetConnection() {
  const conn = await origGetConn();
  try {
    await prepareSession(conn);
  } catch (e) {
    console.warn("[db] prepareSession warning:", e?.message || e);
  }
  return conn;
};

/* =========================
 * One-time startup check (optional)
 * ========================= */
(async () => {
  try {
    const conn = await pool.getConnection();
    try {
      const [[info]] = await conn.query(
        "SELECT DATABASE() AS db, VERSION() AS ver, @@character_set_server AS chs, @@collation_server AS col, @@hostname AS host, @@ssl_cipher AS cipher"
      );
      console.log("[DB] server =>", info);

      const [[sess]] = await conn.query(
        "SELECT @@character_set_connection AS ch_conn, @@collation_connection AS col_conn, @@time_zone AS tz"
      );
      console.log("[DB] session =>", sess);

      const [users] = await conn.query("SHOW TABLES LIKE 'users'");
      const [tenants] = await conn.query("SHOW TABLES LIKE 'tenants'");
      const [invs] = await conn.query("SHOW TABLES LIKE 'invoices'");
      console.log(
        "[DB] has tables => users:", users.length > 0,
        "| tenants:", tenants.length > 0,
        "| invoices:", invs.length > 0
      );
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error("DB init check error:", e?.stack || e);
  }
})();

/* =========================
 * Exports
 * ========================= */
module.exports = pool;
// เผื่อบางไฟล์เรียกแบบ pool.getConnection() จาก export
module.exports.getConnection = () => pool.getConnection();
