// ...existing code...
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// โหลด env (ปลอดภัย ถ้ามีการโหลดก่อนแล้ว จะถูก ignore)
try {
  require('dotenv').config({ path: path.join(__dirname, '..', '.envlocal') });
} catch (e) {}

/* config */
const host = process.env.DB_HOST || '127.0.0.1';
const port = Number(process.env.DB_PORT || 3306);
const user = process.env.DB_USER || 'root';
const password = process.env.DB_PASSWORD || '';
const database = process.env.DB_NAME || 'dormitory_management';

function readCA() {
  const file = process.env.DB_SSL_CA_FILE;
  if (!file) return null;
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (e) {
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

// If DB_SSL=1 or known host (Aiven), attach ssl options.
// To REQUIRE SSL set DB_SSL=1 and provide DB_SSL_CA_FILE.
// If using self-signed CA in dev, DB_ALLOW_SELF_SIGNED=1 will set rejectUnauthorized=false.
if (process.env.DB_SSL === '1' || /aivencloud\.com$/i.test(host)) {
  const ca = readCA();
  const allowSelfSigned = process.env.DB_ALLOW_SELF_SIGNED === '1' || process.env.NODE_ENV !== 'production';

  // mysql2 expects 'ssl' object; include ca as string
  cfg.ssl = {
    // include CA only if present
    ...(ca ? { ca } : {}),
    // SNI servername helps when connecting to cloud providers
    servername: host,
    // rejectUnauthorized true enforces server cert verification
    rejectUnauthorized: !allowSelfSigned,
    minVersion: 'TLSv1.2',
  };

  if (!ca && !allowSelfSigned) {
    console.warn('DB SSL: no CA provided and self-signed not allowed — connection may fail.');
  } else if (!ca && allowSelfSigned) {
    console.warn('DB SSL: no CA provided — allowing self-signed certs (dev only).');
  }
}

const pool = mysql.createPool(cfg);
module.exports = pool;

// quick diagnostic to know whether SSL was negotiated
(async () => {
  try {
    const conn = await pool.getConnection();
    try {
      // GET ssl cipher used by session: returns empty string if no SSL
      const [rows] = await conn.query("SELECT @@ssl_cipher AS ssl_cipher, @@version_comment AS version_comment, @@version AS version");
      const info = rows && rows[0] ? rows[0] : {};
      const cipher = info.ssl_cipher || '';
      console.log('Using host/port :', host, port, 'SSL=', cipher ? 'ON' : 'OFF');
      console.log('✅ Connected');
      console.log('  version :', info.version || '(unknown)');
      if (cipher) console.log('  ssl cipher:', cipher);
      else console.log('  ssl cipher: (none)');
    } finally {
      conn.release();
    }
  } catch (err) {
    // surface helpful messages
    if (err && err.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('❌ DB access denied: check DB_USER/DB_PASSWORD/DB_HOST/DB_PORT in backend/.envlocal');
    } else if (err && (err.message || '').includes('self-signed')) {
      console.error('❌ DB SSL error:', err.message);
      console.error('   For dev: set DB_ALLOW_SELF_SIGNED=1 or provide DB_SSL_CA_FILE with the provider CA.');
    } else {
      console.error('❌ DB connection error:', err && err.message ? err.message : err);
    }
    if (process.env.NODE_ENV === 'production') process.exit(1);
  }
})();
// ...existing code...