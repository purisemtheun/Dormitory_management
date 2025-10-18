
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { enc } = require('../utils/crypto');
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');
const { pushMessage, refreshSettings } = require('../services/lineService');

// helper: สุ่มโค้ดอ่านง่าย (ตัด O/0/I/1 ออก)
function generateCode(len = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

// ทุก route ใต้ไฟล์นี้ต้องเป็น admin/staff
router.use(verifyToken, authorizeRoles('admin', 'staff'));

/* GET settings (mask) */
router.get('/admin/line/settings', async (_req, res, next) => {
  try {
    const [rows] = await db.query(
      'SELECT channel_id, updated_by, updated_at, (access_token IS NOT NULL) AS has_token FROM line_settings ORDER BY id DESC LIMIT 1'
    );
    if (!rows.length) return res.json({ channel_id: '', has_token: false });

    const row = rows[0];
    res.json({
      channel_id: row.channel_id || '',
      has_token: !!row.has_token,
      updated_by: row.updated_by,
      updated_at: row.updated_at,
    });
  } catch (e) {
    next(e);
  }
});

/* PUT settings (encrypt & upsert single row) */
router.put('/admin/line/settings', async (req, res, next) => {
  try {
    const { channel_id, channel_secret, access_token } = req.body || {};
    if (!channel_id) return res.status(400).json({ error: 'channel_id required' });

    await db.query('DELETE FROM line_settings'); // เก็บแถวเดียว
    await db.query(
      `INSERT INTO line_settings (channel_id, channel_secret, access_token, updated_by, updated_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [
        channel_id,
        channel_secret ? enc(channel_secret) : null,
        access_token ? enc(access_token) : null,
        req.user?.id || null,
      ]
    );

    await refreshSettings();
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

/* POST test push */
router.post('/admin/line/test-push', async (req, res, next) => {
  try {
    const { line_user_id, text } = req.body || {};
    if (!line_user_id || !text) return res.status(400).json({ error: 'line_user_id & text required' });

    await pushMessage(line_user_id, text);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

/* NEW: ออกโค้ดผูกบัญชีผู้เช่า (เก็บเป็น tenants.tenant_id) */
router.post('/admin/line/link-token', async (req, res, next) => {
  try {
    const { tenant_id } = req.body || {};
    if (!tenant_id) return res.status(400).json({ error: 'tenant_id required' });

    // ✅ ยืนยันว่า tenant_id ที่ส่งมาเป็นคีย์ในตาราง tenants (id หรือ tenant_id ก็ได้)
    const [[t]] = await db.query(
      `SELECT tenant_id FROM tenants WHERE id = ? OR tenant_id = ? LIMIT 1`,
      [tenant_id, tenant_id]
    );
    if (!t) return res.status(404).json({ error: 'tenant not found' });
    const tenantKey = t.tenant_id; // มาตรฐาน: เก็บเป็น tenants.tenant_id

    // กันโค้ดซ้ำ (เช็คด้วย code — ไม่อ้าง id)
    let code = generateCode(6);
    for (let i = 0; i < 5; i++) {
      const [dups] = await db.query('SELECT code FROM link_tokens WHERE code = ? LIMIT 1', [code]);
      if (!dups.length) break;
      code = generateCode(6);
    }

    // อายุโค้ด 24 ชม.
    await db.query(
      `INSERT INTO link_tokens (tenant_id, code, expires_at)
       VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 DAY))`,
      [tenantKey, code]
    );

    res.json({ tenant_id: tenantKey, code, expires_in_hours: 24 });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
