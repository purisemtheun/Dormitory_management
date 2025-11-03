// ...existing code...
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const host = process.env.DB_HOST || '127.0.0.1';
const port = Number(process.env.DB_PORT || 3306);

function readCA() {
  let ca = (process.env.DB_SSL_CA || '').trim();
  if (!ca) ca = (process.env.DB_CA || '').trim();
  if (!ca && process.env.DB_CA_B64) {
    try { ca = Buffer.from(process.env.DB_CA_B64, 'base64').toString('utf8').trim(); } catch {}
  }
  if (!ca) {
    const filePath = process.env.DB_SSL_CA_FILE || path.join(__dirname, 'aiven-ca.pem'); // ชี้ไฟล์ Aiven
    try { ca = fs.readFileSync(filePath, 'utf8').trim(); } catch {}
  }
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

// ENABLE SSL when explicitly requested or for known hosts (e.g. Aiven)
if (process.env.DB_SSL === '1' || /aivencloud\.com$/i.test(host)) {
  const ca = readCA();

  // Allow self-signed certs in non-production or when explicitly allowed via env.
  // WARNING: DB_ALLOW_SELF_SIGNED=1 should NOT be used in production.
  const allowSelfSigned = process.env.DB_ALLOW_SELF_SIGNED === '1' || process.env.NODE_ENV !== 'production';

  cfg.ssl = {
    minVersion: 'TLSv1.2',
    servername: host, // SNI
    // If CA is present use it; otherwise, optionally accept self-signed certs.
    ...(ca ? { ca } : {}),
    // rejectUnauthorized = false will accept self-signed certs.
    rejectUnauthorized: !allowSelfSigned,
  };

  if (!ca && allowSelfSigned) {
    console.warn('DB SSL: no CA provided — allowing self-signed certificates (DB_ALLOW_SELF_SIGNED=1 or NODE_ENV!=production).');
  } else if (!ca && !allowSelfSigned) {
    console.warn('DB SSL: no CA provided and self-signed certs not allowed — connection may fail (set DB_CA / DB_SSL_CA or DB_ALLOW_SELF_SIGNED=1 for dev).');
  }
}

module.exports = mysql.createPool(cfg);
// ...existing code...