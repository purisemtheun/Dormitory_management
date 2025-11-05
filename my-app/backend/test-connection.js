// ...existing code...
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// load env (safe) — prefer backend/.envlocal, fallback to parent
try {
  const local = path.join(__dirname, '.envlocal');
  const parent = path.join(__dirname, '..', '.envlocal');
  const envPath = fs.existsSync(local) ? local : fs.existsSync(parent) ? parent : null;
  if (envPath) {
    require('dotenv').config({ path: envPath });
    console.log('Loaded env from', envPath);
  } else {
    console.warn('No .envlocal found at', local, 'or', parent);
  }
} catch (e) { /* ignore */ }

const host = process.env.DB_HOST || '127.0.0.1';
const port = Number(process.env.DB_PORT || 3306);
const user = process.env.DB_USER || 'root';
const password = process.env.DB_PASSWORD || '';
const database = process.env.DB_NAME || 'dormitory_management';

function readCA() {
  const file = process.env.DB_SSL_CA_FILE;
  if (!file) return null;
  try {
    const content = fs.readFileSync(file, 'utf8');
    return content;
  } catch (e) {
    console.warn('DB: failed to read DB_SSL_CA_FILE=', file, e.message);
    return null;
  }
}

const cfg = {
  host,
  port,
  user,
  password,
  database,
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONN_LIMIT || 10),
  queueLimit: 0,
  charset: 'utf8mb4',
  timezone: 'Z',
};

// SSL config if requested or known host (Aiven)
if (process.env.DB_SSL === '1' || /aivencloud\.com$/i.test(host)) {
  const ca = readCA();
  const allowSelfSigned = process.env.DB_ALLOW_SELF_SIGNED === '1' || process.env.NODE_ENV !== 'production';

  cfg.ssl = {
    ...(ca ? { ca } : {}),
    rejectUnauthorized: !allowSelfSigned,
    servername: host,
    minVersion: 'TLSv1.2',
  };

  console.log('DB SSL config -> CA present:', !!ca, 'allowSelfSigned:', allowSelfSigned);
}

const pool = mysql.createPool(cfg);

// diagnostic: log actual TLS negotiation result using @@ssl_cipher
(async () => {
  try {
    const conn = await pool.getConnection();
    const [[ver]] = await conn.query('SELECT VERSION() AS version, @@hostname AS host, NOW() AS time');
    const [[ssl]] = await conn.query("SHOW SESSION STATUS LIKE 'Ssl_cipher'");
    const cipher = ssl && ssl.Value ? ssl.Value : '';
    console.log(`DB connected -> host=${host}:${port}  version=${ver.version}  ssl_cipher=${cipher || '(none)'}  TLS=${cipher ? 'ON' : 'OFF'}`);
    conn.release();
  } catch (err) {
    console.error('DB connection diagnostic failed:', err && err.message ? err.message : err);
  }
})();

module.exports = pool;
// ...existing code...