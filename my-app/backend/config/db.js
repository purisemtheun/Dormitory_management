// backend/db.js  (หรือ backend/config/db.js)
const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'dorm_db',
  port: Number(process.env.DB_PORT) || 3306,
  charset: 'utf8mb4',          // รองรับภาษาไทย/อีโมจิ
  waitForConnections: true,    // แทนที่จะโยน error เมื่อเต็ม
  connectionLimit: 10,         // ปรับตามเครื่อง
  queueLimit: 0,
  timezone: 'Z',               // เก็บเป็น UTC (แนะนำให้สอดคล้องทั้งระบบ)
  dateStrings: false           // ถ้าอยากให้ DATE/TIMESTAMP เป็น String ให้ปรับเป็น true
});

module.exports = pool;
