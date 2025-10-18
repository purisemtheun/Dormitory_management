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
  } catch (e) {
    next(e);
  }
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
  } catch (e) {
    next(e);
  }
});

/* 🔍 DEBUG: ดูข้อมูลบอท (ตรวจ token ปัจจุบันชี้ไปที่บอทไหน) */
router.get('/admin/line/bot-info', async (_req, res, next) => {
  try {
    const info = await getBotInfo();
    res.json(info);
  } catch (e) {
    next(e);
  }
});

/* 🔍 DEBUG: ตรวจ userId นี้อยู่กับบอทตัวนี้ไหม */
router.post('/admin/line/debug/recipient', async (req, res, next) => {
  try {
    const { line_user_id } = req.body || {};
    if (!line_user_id) return res.status(400).json({ error: 'line_user_id required' });
    if (!isValidLineRecipient(line_user_id)) {
      return res.status(400).json({ error: `Invalid line_user_id: "${line_user_id}". Expect U|R|C + 32 hex.` });
    }
    const profile = await getUserProfile(line_user_id); // ถ้า mismatch/ไม่เป็นเพื่อน -> error
    res.json({ ok: true, profile });
  } catch (e) {
    const msg = String(e.message || e);
    if (msg.includes('error 404') || msg.includes('error 400')) {
      return res.status(400).json({
        ok: false,
        error: 'Recipient not found for this bot token. Likely using a different Channel token or the user hasn’t added the bot.',
        detail: msg,
      });
    }
    next(e);
  }
});

/* POST test push (ส่งหา LINE ID โดยตรง) */
router.post('/admin/line/test-push', async (req, res, next) => {
  try {
    const { line_user_id, text } = req.body || {};
    if (!line_user_id || !text) {
      return res.status(400).json({ error: 'line_user_id & text required' });
    }
    if (!isValidLineRecipient(line_user_id)) {
      return res.status(400).json({
        error: `Invalid line_user_id: "${line_user_id}". Expect U|R|C + 32 hex.`,
      });
    }

    await getUserProfile(line_user_id);
    await pushMessage(line_user_id.trim(), text);
    res.json({ ok: true, to: line_user_id.trim() });
  } catch (e) {
    next(e);
  }
});

/* POST /admin/line/link-token — ออกโค้ดผูกบัญชีให้ tenant */
router.post('/admin/line/link-token', async (req, res, next) => {
  try {
    const { tenant_id } = req.body || {};
    if (!tenant_id) return res.status(400).json({ error: 'tenant_id required' });

    const [[t]] = await db.query(
      `SELECT tenant_id FROM tenants WHERE tenant_id = ? LIMIT 1`,
      [tenant_id]
    );
    if (!t) return res.status(404).json({ error: 'tenant not found' });

    const tenantKey = t.tenant_id;

    let code = generateCode(6);
    for (let i = 0; i < 5; i++) {
      const [dups] = await db.query('SELECT code FROM link_tokens WHERE code = ? LIMIT 1', [code]);
      if (!dups.length) break;
      code = generateCode(6);
    }

    await db.query(
      `INSERT INTO link_tokens (tenant_id, code, expires_at, created_at)
       VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 DAY), NOW())`,
      [tenantKey, code]
    );

    res.json({ tenant_id: tenantKey, code, expires_in_hours: 24 });
  } catch (e) {
    next(e);
  }
});

/* ============== NEW: รายการผู้เช่าที่มีบิลงวดนี้แต่ยังไม่ผูก LINE ============== */
router.get('/admin/line/unlinked', async (req, res, next) => {
  try {
    const period_ym = req.query.period_ym;
    if (!period_ym) return res.status(400).json({ error: 'period_ym required' });

    const [rows] = await db.query(
      `
      SELECT DISTINCT i.tenant_id,
             COALESCE(u.fullname, u.name, CONCAT('Tenant#', i.tenant_id)) AS tenant_name,
             t.room_id
      FROM invoices i
      JOIN tenants t ON t.tenant_id = i.tenant_id
      LEFT JOIN users u ON u.id = t.user_id
      LEFT JOIN tenant_line_links l ON l.tenant_id = i.tenant_id
      WHERE i.period_ym = ? AND l.tenant_id IS NULL
      ORDER BY i.tenant_id
      `,
      [period_ym]
    );

    res.json(rows);
  } catch (e) {
    next(e);
  }
});

/* ============== NEW: ออกโค้ดผูกบัญชีแบบเป็นชุด ตามงวดที่ระบุ ============== */
router.post('/admin/line/link-tokens/bulk', async (req, res, next) => {
  try {
    const { period_ym } = req.body || {};
    if (!period_ym) return res.status(400).json({ error: 'period_ym required' });

    const [tenants] = await db.query(
      `
      SELECT DISTINCT i.tenant_id
      FROM invoices i
      LEFT JOIN tenant_line_links l ON l.tenant_id = i.tenant_id
      WHERE i.period_ym = ? AND l.tenant_id IS NULL
      ORDER BY i.tenant_id
      `,
      [period_ym]
    );

    const out = [];
    for (const r of tenants) {
      const tenant_id = r.tenant_id;
      let code = generateCode(6);
      for (let i = 0; i < 5; i++) {
        const [dups] = await db.query('SELECT code FROM link_tokens WHERE code = ? LIMIT 1', [code]);
        if (!dups.length) break;
        code = generateCode(6);
      }
      await db.query(
        `INSERT INTO link_tokens (tenant_id, code, expires_at, created_at)
         VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 DAY), NOW())`,
        [tenant_id, code]
      );
      out.push({ tenant_id, code, expires_in_hours: 24 });
    }

    res.json({ ok: true, count: out.length, items: out });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
