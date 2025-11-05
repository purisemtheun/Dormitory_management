// backend/config/db.js
"use strict";
const fs = require("fs");
const mysql = require("mysql2/promise");

function bool(v) {
  return String(v || "").toLowerCase() === "true" || String(v || "") === "1";
}

function buildSSL() {
  if (!bool(process.env.DB_SSL)) return undefined;

  // 1) STRING PEM ใน ENV (แนะนำบน Render) – รองรับ \n ที่ถูก escape
  if (process.env.DB_SSL_CA) {
    const ca = process.env.DB_SSL_CA.replace(/\\n/g, "\n");
    return { ca };
  }

  // 2) BASE64 PEM ใน ENV
  if (process.env.DB_SSL_CA_B64) {
    const ca = Buffer.from(process.env.DB_SSL_CA_B64, "base64").toString("utf8");
    return { ca };
  }

  // 3) ไฟล์บนดิสก์ (ใช้เฉพาะตอนรันบนเครื่องเรา)
  const p = process.env.DB_SSL_CA_FILE;
  if (p && typeof p === "string") {
    try {
      const ca = fs.readFileSync(p, "utf8");
      return { ca };
    } catch (e) {
      console.warn("[DB] Cannot read DB_SSL_CA_FILE:", p, e.message);
    }
  }

  // 4) ถ้าเปิด DB_SSL ไว้แต่ไม่เจอ CA เลย ก็ปล่อย ssl object เปล่า
  //    (หลายผู้ให้บริการยอมรับได้ หรือใช้ cert ของระบบ)
  return {};
}

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_POOL || 10),
  ssl: buildSSL(),
  timezone: "Z", // เก็บเป็น UTC
});

module.exports = pool;
module.exports.getConnection = () => pool.getConnection();
