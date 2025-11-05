// backend/config/db.js
const fs = require('fs');
const mysql = require('mysql2/promise');

/* ===== SSL (ถ้ามี) ===== */
const ssl =
  process.env.DB_SSL && process.env.DB_SSL !== '0'
    ? { ca: fs.readFileSync(process.env.DB_SSL_CA_FILE, 'utf8') }
    : undefined;

/* ===== สร้าง Pool โดย “บังคับ” ให้ใช้ UTF-8 เสมอ =====
 * - charset: กำหนด character set ระดับ connection
 * - เราจะสั่ง SET NAMES/SET collation_connection อีกชั้นหลังเชื่อมต่อ (กันพลาด)
 */
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  ssl,
  charset: 'utf8mb4',           // สำคัญ
  supportBigNumbers: true,
  dateStrings: true,
});

/* ===== บังคับ session ให้เป็น utf8mb4_unicode_ci ทุกครั้งที่ยืม connection ===== */
async function prepareSession(conn) {
  // SET NAMES จะตั้ง character_set_client/connection/results ให้เป็น utf8mb4
  await conn.query("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
  await conn.query("SET collation_connection = 'utf8mb4_unicode_ci'");
  // ตั้ง timezone ให้เหมาะ (ปรับตามต้องการ)
  if (process.env.TZ || process.env.APP_TZ) {
    const tz = process.env.APP_TZ || process.env.TZ;
    await conn.query("SET time_zone = ?", [tz]);
  }
}

pool.getConnection = (function (orig) {
  return async function patchedGetConnection() {
    const conn = await orig.call(this);
    try {
      await prepareSession(conn);
    } catch (e) {
      // ไม่ให้พังทั้งแอป ถ้าตั้ง session fail ก็ปล่อยไป แต่ log ไว้
      console.warn('[db] prepareSession warning:', e?.message || e);
    }
    return conn;
  };
})(pool.getConnection);

/* ===== Debug ตอนสตาร์ต: ตรวจฐาน, collation, และตารางสำคัญ ===== */
(async () => {
  const conn = await pool.getConnection();
  try {
    const [[info]] = await conn.query(
      "SELECT DATABASE() AS db, VERSION() AS ver, @@character_set_server AS chs, @@collation_server AS col, @@hostname AS host, @@ssl_cipher AS cipher"
    );
    console.log('DB check =>', info);

    const [[sess]] = await conn.query(
      "SELECT @@character_set_connection AS ch_conn, @@collation_connection AS col_conn"
    );
    console.log('Session charset/collation =>', sess);

    const [users]   = await conn.query("SHOW TABLES LIKE 'users'");
    const [tenants] = await conn.query("SHOW TABLES LIKE 'tenants'");
    const [invs]    = await conn.query("SHOW TABLES LIKE 'invoices'");
    console.log('Has users:', users.length > 0, '| tenants:', tenants.length > 0, '| invoices:', invs.length > 0);
  } finally {
    conn.release();
  }
})().catch(err => console.error('DB init check error:', err));

module.exports = pool;
