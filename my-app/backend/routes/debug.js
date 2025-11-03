// backend/routes/debug.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');

/**
 * GET /api/debug/db
 * ใช้เช็คว่าปัจจุบันต่อ DB ตัวใดอยู่ (host/user/db)
 * แนะนำให้ปิดใน production ภายหลังใช้งานเสร็จ
 */
router.get('/db', async (_req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        @@hostname      AS host,
        @@version       AS version,
        CURRENT_USER()  AS current_user,
        DATABASE()      AS current_db
    `);
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

module.exports = router;
