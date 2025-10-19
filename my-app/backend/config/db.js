// backend/config/db.js
const mysql = require('mysql2/promise');

const host = process.env.DB_HOST || '127.0.0.1';
const port = Number(process.env.DB_PORT || 3306);

function readCA() {
  // 1) ENV ใหม่
  let ca = (process.env.DB_SSL_CA || '').trim();
  // 2) ENV เดิม (รองรับชื่อ DB_CA)
  if (!ca) ca = (process.env.DB_CA || '').trim();
  // 3) base64 (ถ้าใส่มา)
  if (!ca && process.env.DB_CA_B64) {
    try { ca = Buffer.from(process.env.DB_CA_B64, 'base64').toString('utf8').trim(); } catch {}
  }
  // 4) กรณีใส่ \n ใน .env ให้แปลงกลับเป็น newline จริง
  if (ca && ca.includes('\\n')) ca = ca.replace(/\\n/g, '\n');
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
  timezone: 'Z',
};

// TLS/SSL (Aiven บังคับ)
if (process.env.DB_SSL === '1' || /aivencloud\.com$/i.test(host)) {
  const ca = readCA();
  const reject = String(process.env.DB_SSL_REJECT_UNAUTHORIZED || 'true') === 'true';
  cfg.ssl = ca
    ? { ca, minVersion: 'TLSv1.2', servername: host, rejectUnauthorized: reject }
    : { minVersion: 'TLSv1.2', servername: host, rejectUnauthorized: reject }; // ไม่มี CA ก็ยัง TLS (ถ้าอยากผ่อนปรน ใส่ DB_SSL_REJECT_UNAUTHORIZED=false)
}

module.exports = mysql.createPool(cfg);
