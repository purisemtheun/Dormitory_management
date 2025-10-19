// backend/config/db.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const fs = require('fs');
const mysql = require('mysql2/promise');

const host = process.env.DB_HOST || '127.0.0.1';
let ssl;
if (host.includes('aivencloud.com')) {
  const caPath = path.join(__dirname, '../certs/ca.pem');
  ssl = { ca: fs.readFileSync(caPath), minVersion: 'TLSv1.2', servername: host };
}

const pool = mysql.createPool({
  host,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'dormitory_management',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
  timezone: 'Z',
  ssl, // จะเปิดเฉพาะตอน host เป็น aivencloud.com
});

module.exports = pool;
