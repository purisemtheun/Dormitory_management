const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const fs = require('fs');
const mysql = require('mysql2/promise');

// ใช CA ถาม (สำหรบ Aiven)
let ssl;
try {
  const caPath = path.join(__dirname, 'certs', 'ca.pem');
  if (fs.existsSync(caPath)) ssl = { ca: fs.readFileSync(caPath), minVersion: 'TLSv1.2' };
} catch (_) {}

(async () => {
  try {
    const pool = mysql.createPool({
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'dormitory_management',
      waitForConnections: true,
      connectionLimit: 5,
      ssl
    });

    const [[row]] = await pool.query('SELECT @@version AS ver, @@hostname AS host, NOW() AS now');
    console.log(' Connected');
    console.log('  version :', row.ver);
    console.log('  host    :', row.host);
    console.log('  time    :', row.now);
    await pool.end();
  } catch (e) {
    console.error(' Connection failed:', e.message);
    process.exit(1);
  }
})();
