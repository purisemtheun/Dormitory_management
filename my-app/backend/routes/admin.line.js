// backend/routes/admin.line.js
const express = require('express');
const router = express.Router();

const db = require('../config/db');
const { enc } = require('../utils/crypto');
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');

const {
  pushMessage,
  refreshSettings,
  isValidLineRecipient,
  getBotInfo,
  getUserProfile,
} = require('../services/lineService');

const { createNotification } = require('../services/notification');
const { pushLineAfterNotification } = require('../services/notifyAfterInsert');

// ────────────────────────────────────────────────────────────
// ทุกเส้นทางต้องเป็น admin/staff
// ────────────────────────────────────────────────────────────
router.use(verifyToken, authorizeRoles('admin', 'staff'));

// ────────────────────────────────────────────────────────────
// (DEV ONLY) Routes สำหรับทดสอบแบบ manual
// จะถูกเปิดใช้งานเฉพาะเมื่อ NODE_ENV !== 'production'
// ────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'production') {
  /* TEST: ยิงแจ้งเตือนแบบ manual (บันทึกลง notifications และส่ง LINE) */
  router.post('/admin/line/test-noti', async (req, res, next) => {
    try {
      const { tenant_id, title, body, type = 'manual_test' } = req.body || {};
      if (!tenant_id || !title) return res.status(400).json({ error: 'tenant_id & title required' });
      const result = await createNotification({
        tenant_id,
        type,
        title,
        body,
        created_by: req.user?.id ?? null,
      });
      res.json(result);
    } catch (e) { next(e); }
  });

  /* TEST: push ตรงด้วย line_user_id */
  router.post('/admin/line/test-push', async (req, res, next) => {
    try {
      const { line_user_id, text } = req.body || {};
      if (!line_user_id || !text) return res.status(400).json({ error: 'line_user_id & text required' });
      if (!isValidLineRecipient(line_user_id)) {
        return res.status(400).json({ error: `Invalid line_user_id: "${line_user_id}". Expect U|R|C + 32 hex.` });
      }
      await getUserProfile(line_user_id); // ตรวจว่า user นี้อยู่กับบอทเรา
      await pushMessage(line_user_id.trim(), text);
      res.json({ ok: true, to: line_user_id.trim() });
    } catch (e) { next(e); }
  });
}

// ────────────────────────────────────────────────────────────
// Settings (เก็บลงตาราง line_settings และรีเฟรชเข้า service)
// ────────────────────────────────────────────────────────────

/* GET settings (mask some fields) */
router.get('/admin/line/settings', async (_req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT channel_id, updated_by, updated_at,
              (access_token IS NOT NULL AND access_token <> '') AS has_token
         FROM line_settings
        ORDER BY updated_at DESC
        LIMIT 1`
    );
    if (!rows.length) return res.json({ channel_id: '', has_token: false });
    const row = rows[0];
    res.json({
      channel_id: row.channel_id || '',
      has_token: !!row.has_token,
      updated_by: row.updated_by,
      updated_at: row.updated_at,
    });
  } catch (e) { next(e); }
});

/* PUT settings (encrypt & upsert single row) */
router.put('/admin/line/settings', async (req, res, next) => {
  try {
    const { channel_id, channel_secret, access_token } = req.body || {};
    if (!channel_id) return res.status(400).json({ error: 'channel_id required' });

    await db.query('DELETE FROM line_settings');
    await db.query(
      `INSERT INTO line_settings (channel_id, channel_secret, access_token, updated_by, updated_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [
        channel_id,
        channel_secret ? enc(channel_secret, process.env.MASTER_KEY) : null,
        access_token ? enc(access_token, process.env.MASTER_KEY) : null,
        req.user?.id || null,
      ]
    );

    await refreshSettings();
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ────────────────────────────────────────────────────────────
// Debug helpers
// ────────────────────────────────────────────────────────────

/* ดูข้อมูลบอทว่าชี้ไปที่ Channel ไหน */
router.get('/admin/line/bot-info', async (_req, res, next) => {
  try { res.json(await getBotInfo()); }
  catch (e) { next(e); }
});

/* ตรวจว่ารหัสผู้รับ (U/R/C...) เป็นของบอทเราหรือไม่ */
router.post('/admin/line/debug/recipient', async (req, res, next) => {
  try {
    const { line_user_id } = req.body || {};
    if (!line_user_id) return res.status(400).json({ error: 'line_user_id required' });
    if (!isValidLineRecipient(line_user_id)) {
      return res.status(400).json({ error: `Invalid line_user_id: "${line_user_id}". Expect U|R|C + 32 hex.` });
    }
    const profile = await getUserProfile(line_user_id);
    res.json({ ok: true, profile });
  } catch (e) {
    const msg = String(e.message || e);
    if (msg.includes('error 404') || msg.includes('error 400')) {
      return res.status(400).json({
        ok: false,
        error: 'Recipient not found for this bot token (user not added bot or token mismatch).',
        detail: msg,
      });
    }
    next(e);
  }
});

// ────────────────────────────────────────────────────────────
/* โค้ดช่วย: สุ่มรหัสลิงก์ (ไม่เอา O/0/I/1) */
// ────────────────────────────────────────────────────────────
function generateCode(len = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

// ────────────────────────────────────────────────────────────
// ฟีเจอร์ผูกบัญชี
// ────────────────────────────────────────────────────────────

/* ออกโค้ดผูกบัญชีให้ tenant เดี่ยว */
router.post('/admin/line/link-token', async (req, res, next) => {
  try {
    const { tenant_id } = req.body || {};
    if (!tenant_id) return res.status(400).json({ error: 'tenant_id required' });

    const [[t]] = await db.query(`SELECT tenant_id FROM tenants WHERE tenant_id = ? LIMIT 1`, [tenant_id]);
    if (!t) return res.status(404).json({ error: 'tenant not found' });

    let code = generateCode(6);
    for (let i = 0; i < 5; i++) {
      const [dups] = await db.query('SELECT code FROM link_tokens WHERE code = ? LIMIT 1', [code]);
      if (!dups.length) break;
      code = generateCode(6);
    }

    await db.query(
      `INSERT INTO link_tokens (tenant_id, code, expires_at, created_at)
       VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 DAY), NOW())`,
      [t.tenant_id, code]
    );

    res.json({ tenant_id: t.tenant_id, code, expires_in_hours: 24 });
  } catch (e) { next(e); }
});

/* รายการผู้เช่าที่มีบิลงวดนี้แต่ยังไม่ผูก LINE */
router.get('/admin/line/unlinked', async (req, res, next) => {
  try {
    const { period_ym } = req.query;
    if (!period_ym) return res.status(400).json({ error: 'period_ym required' });

    const [rows] = await db.query(
      `SELECT DISTINCT i.tenant_id,
              COALESCE(u.fullname, u.name, CONCAT('Tenant#', i.tenant_id)) AS tenant_name,
              t.room_id
         FROM invoices i
         JOIN tenants t ON t.tenant_id = i.tenant_id
         LEFT JOIN users u ON u.id = t.user_id
         LEFT JOIN tenant_line_links l ON l.tenant_id = i.tenant_id
        WHERE i.period_ym = ? AND l.tenant_id IS NULL
        ORDER BY i.tenant_id`,
      [period_ym]
    );
    res.json(rows);
  } catch (e) { next(e); }
});

/* ออกโค้ดผูกบัญชีแบบเป็นชุด */
router.post('/admin/line/link-tokens/bulk', async (req, res, next) => {
  try {
    const { period_ym } = req.body || {};
    if (!period_ym) return res.status(400).json({ error: 'period_ym required' });

    const [tenants] = await db.query(
      `SELECT DISTINCT i.tenant_id
         FROM invoices i
         LEFT JOIN tenant_line_links l ON l.tenant_id = i.tenant_id
        WHERE i.period_ym = ? AND l.tenant_id IS NULL
        ORDER BY i.tenant_id`,
      [period_ym]
    );

    const out = [];
    for (const r of tenants) {
      let code = generateCode(6);
      for (let i = 0; i < 5; i++) {
        const [dups] = await db.query('SELECT code FROM link_tokens WHERE code = ? LIMIT 1', [code]);
        if (!dups.length) break;
        code = generateCode(6);
      }
      await db.query(
        `INSERT INTO link_tokens (tenant_id, code, expires_at, created_at)
         VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 DAY), NOW())`,
        [r.tenant_id, code]
      );
      out.push({ tenant_id: r.tenant_id, code, expires_in_hours: 24 });
    }
    res.json({ ok: true, count: out.length, items: out });
  } catch (e) { next(e); }
});

/* ส่งข้อความหา tenant ด้วย tenant_id (ใช้ mapping จาก tenant_line_links) */
router.post('/admin/line/push-to-tenant', async (req, res, next) => {
  try {
    const { tenant_id, text } = req.body || {};
    if (!tenant_id || !text) return res.status(400).json({ error: 'tenant_id & text required' });

    const [[row]] = await db.query(
      `SELECT l.line_user_id FROM tenant_line_links l WHERE l.tenant_id = ? LIMIT 1`,
      [tenant_id]
    );
    if (!row?.line_user_id) return res.status(404).json({ error: 'tenant has not linked LINE yet' });

    await pushMessage(row.line_user_id, String(text));
    res.json({ ok: true, to: row.line_user_id, tenant_id });
  } catch (e) { next(e); }
});

// ────────────────────────────────────────────────────────────
// Admin Notifications (list + retry)
// ────────────────────────────────────────────────────────────

/* List ล่าสุด (200 รายการ) */
router.get('/admin/line/notifications', async (_req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT id, tenant_id, type, title, created_at, line_status, sent_line_at
         FROM notifications
        ORDER BY id DESC
        LIMIT 200`
    );
    res.json(rows);
  } catch (e) { next(e); }
});

/* กด retry ส่งซ้ำจาก record เดิม */
router.post('/admin/line/notifications/:id/retry', async (req, res, next) => {
  try {
    const [[n]] = await db.query(`SELECT * FROM notifications WHERE id=? LIMIT 1`, [req.params.id]);
    if (!n) return res.status(404).json({ error: 'noti not found' });

    const r = await pushLineAfterNotification(null, {
      tenant_id: n.tenant_id,
      type: n.type,
      title: n.title,
      body: n.body,
    });

    await db.query(
      `UPDATE notifications
          SET sent_line_at = IF(?, NOW(), sent_line_at),
              line_status  = ?,
              line_error   = NULLIF(?, '')
        WHERE id = ?`,
      [r.ok ? 1 : 0, r.ok ? 'ok' : (r.reason === 'NO_LINE_LINK' ? 'unlinked' : 'fail'), r.error || '', n.id]
    );

    res.json({ ok: !!r.ok, detail: r });
  } catch (e) { next(e); }
});

module.exports = router;
