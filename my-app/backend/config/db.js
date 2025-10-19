// backend/config/db.js
const mysql = require('mysql2/promise');

const host = process.env.DB_HOST || '127.0.0.1';
const port = Number(process.env.DB_PORT || 3306);

const cfg = {
  host,
  port,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'dormitory_management',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',     // รองรับอีโมจิ
  timezone: 'Z',          // หรือ '+07:00' ถ้าต้องการ
};

// ── SSL/TLS: Aiven บังคับ TLS ──────────────────────────────
// ใช้เมื่อ DB_SSL=1 หรือ host เป็น aivencloud.com
if (process.env.DB_SSL === '1' || /aivencloud\.com$/i.test(host)) {
  // 1) อ่าน CA จาก ENV (หลายบรรทัดได้)
  let ca = process.env.DB_CA;
  // 2) หรืออ่านจาก base64 ถ้ามี
  if (!ca && process.env.DB_CA_B64) {
    try { ca = Buffer.from(process.env.DB_CA_B64, 'base64').toString('utf8'); } catch {}
  }

  if (ca && ca.trim()) {
    cfg.ssl = { ca, minVersion: 'TLSv1.2', servername: host };
  } else {
    // ไม่มี CA → ยังบังคับ TLS แต่ไม่ตรวจ CA (เหมาะแค่เดโม)
    cfg.ssl = { rejectUnauthorized: false, minVersion: 'TLSv1.2', servername: host };
  }
}

const pool = mysql.createPool(cfg);
module.exports = pool;
