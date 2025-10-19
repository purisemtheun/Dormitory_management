// backend/test-connection.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') }); // โหลด backend/.env
const fs = require('fs');
const mysql = require('mysql2/promise');

const host = process.env.DB_HOST || '127.0.0.1';
const port = Number(process.env.DB_PORT || 3306);

// เปิด SSL เฉพาะตอนต่อ Aiven
let ssl;
try {
  if (host.includes('aivencloud.com')) {
    const caPath = path.join(__dirname, 'certs', 'ca.pem');
    ssl = { ca: fs.readFileSync(caPath), minVersion: 'TLSv1.2', servername: host };
  }
} catch (e) {
  console.error('CA load error:', e.message);
}

(async () => {
  try {
    console.log('DB_HOST =', process.env.DB_HOST);
    console.log('Using host/port :', host, port, 'SSL=', ssl ? 'ON' : 'OFF');

    const pool = mysql.createPool({
      host,
      port,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'dormitory_management',
      waitForConnections: true,
      connectionLimit: 5,
      ssl, // ใส่เฉพาะเมื่อเป็น Aiven
    });

    const [[row]] = await pool.query('SELECT @@version AS ver, @@hostname AS host, NOW() AS now');
    console.log('✅ Connected');
    console.log('  version :', row.ver);
    console.log('  host    :', row.host);
    console.log('  time    :', row.now);
    await pool.end();
  } catch (e) {
    console.error('❌ Connection failed:', e.message);
    process.exit(1);
  }
})();
