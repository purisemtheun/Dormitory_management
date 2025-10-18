// backend/routes/admin.line.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { enc } = require('../utils/crypto');
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');
const { pushMessage, refreshSettings } = require('../services/lineService');

// route นี้ถูก mount ที่ prefix '/api' จาก server.js → path จริงจะเป็น /api/admin/line/...

router.use(verifyToken, authorizeRoles('admin', 'staff'));

/* GET settings (mask) */
router.get('/admin/line/settings', async (_req, res, next) => {
  try {
    const [rows] = await db.query(
      'SELECT channel_id, updated_by, updated_at, (access_token IS NOT NULL) AS has_token FROM line_settings ORDER BY id DESC LIMIT 1'
    );
    if (!rows.length) {
      return res.json({ channel_id: '', has_token: false });
    }
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
    if (!channel_id) {
      return res.status(400).json({ error: 'channel_id required' });
    }

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

    await refreshSettings(); // รีโหลด cache ใน service

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

/* POST test push */
router.post('/admin/line/test-push', async (req, res, next) => {
  try {
    const { line_user_id, text } = req.body || {};
    if (!line_user_id || !text) {
      return res
        .status(400)
        .json({ error: 'line_user_id & text required' });
    }
    await pushMessage(line_user_id, text);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
