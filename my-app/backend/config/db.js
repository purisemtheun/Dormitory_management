// backend/config/db.js
const fs = require('fs');
const mysql = require('mysql2/promise');

/* ---------- SSL config (รองรับทั้ง inline และไฟล์) ---------- */
function buildSSL() {
  const wantSSL =
    String(process.env.DB_SSL || '').toLowerCase() === '1' ||
    String(process.env.DB_SSL || '').toLowerCase() === 'true';

  if (!wantSSL) return undefined;

  // 1) inline CA (แปะมาทั้งบล็อก -----BEGIN CERTIFICATE----- ... )
  const caInline =
    process.env.DB_SSL_CA ||
    process.env.DB_SSL_CA_CERT ||
    process.env.DATABASE_SSL_CA;

  if (caInline && /BEGIN CERTIFICATE/.test(caInline)) {
    return { ca: caInline };
  }

  // 2) อ่านจากไฟล์ (กรณีรันบนเครื่องตัวเอง)
  const caFile = process.env.DB_SSL_CA_FILE;
  if (caFile) {
    try {
      const ca = fs.readFileSync(caFile, 'utf8');
      return { ca };
    } catch (e) {
      console.warn('[db] Cannot read DB_SSL_CA_FILE:', e.message);
    }
  }

  // ถ้าบังคับ SSL แต่ไม่มี CA ก็ให้คืน object ว่าง (บางผู้ให้บริการยอมรับ)
  return {};
}

const ssl = buildSSL();

/* ---------- สร้าง Pool ---------- */
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_POOL_LIMIT || 10),
  charset: 'utf8mb4',
  supportBigNumbers: true,
  dateStrings: true,
  ssl, // undefined = ไม่ใช้ SSL
});

/* ---------- ตั้งค่าภาษา/โซนเวลา เมื่อมีการสร้าง connection ใหม่ ---------- */
pool.on('connection', async (conn) => {
  try {
    await conn.query("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
    await conn.query("SET collation_connection = 'utf8mb4_unicode_ci'");
    const tz = process.env.APP_TZ || process.env.TZ;
    if (tz) await conn.query('SET time_zone = ?', [tz]);
  } catch (e) {
    console.warn('[db] prepare session warning:', e.message);
  }
});

/* ---------- Debug ตอนสตาร์ต (ไม่ผูก getConnection ทับ) ---------- */
(async () => {
  try {
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

      const [users] = await conn.query("SHOW TABLES LIKE 'users'");
      const [tenants] = await conn.query("SHOW TABLES LIKE 'tenants'");
      const [invs] = await conn.query("SHOW TABLES LIKE 'invoices'");
      console.log(
        'Has users:', !!users.length,
        '| tenants:', !!tenants.length,
        '| invoices:', !!invs.length
      );
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('DB init check error:', err);
  }
})();

module.exports = pool;
