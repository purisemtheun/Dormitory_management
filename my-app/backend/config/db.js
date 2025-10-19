// backend/config/db.js
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const host = process.env.DB_HOST || '127.0.0.1';
const port = Number(process.env.DB_PORT || 3306);

function readCA() {
  // 1) ENV ใหม่ (แนะนำ)
  let ca = (process.env.DB_SSL_CA || '').trim();
  // 2) ENV เดิม (fallback)
  if (!ca) ca = (process.env.DB_CA || '').trim();
  // 3) Base64 (ถ้ามี)
  if (!ca && process.env.DB_CA_B64) {
    try { ca = Buffer.from(process.env.DB_CA_B64, 'base64').toString('utf8').trim(); } catch {}
  }
  // 4) จากไฟล์ (กำหนดทาง ENV หรือใช้ไฟล์ดีฟอลต์ในโปรเจกต์)
  if (!ca) {
    const filePath = process.env.DB_SSL_CA_FILE || path.join(__dirname, 'aiven-ca.pem');
    try { ca = fs.readFileSync(filePath, 'utf8').trim(); } catch {}
  }
  if (ca && ca.includes('\\n')) ca = ca.replace(/\\n/g, '\n'); // รองรับกรณีวาง ENV แบบ single-line
  return ca || null;
}

const cfg = {
  host,
  port,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'dormitory_management',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
  timezone: 'Z', // ใช้ UTC; ถ้าจะใช้เวลาไทย ให้เป็น '+07:00'
};

// ── SSL/TLS (Aiven ส่วนใหญ่บังคับ TLS) ─────────────────────
if (process.env.DB_SSL === '1' || /aivencloud\.com$/i.test(host)) {
  const ca = readCA();
  const reject = String(process.env.DB_SSL_REJECT_UNAUTHORIZED || 'true') === 'true';
  cfg.ssl = ca
    ? { ca, minVersion: 'TLSv1.2', servername: host, rejectUnauthorized: reject }
    // ไม่มี CA → อย่าเพิ่งปิดความปลอดภัยถ้าไม่จำเป็น
    : { minVersion: 'TLSv1.2', servername: host, rejectUnauthorized: reject };
}

const pool = mysql.createPool(cfg);
module.exports = pool;
