// backend/routes/notifications.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken } = require('../middlewares/authMiddleware');

/* helper: คืน tenant_id ของผู้ใช้ปัจจุบัน (ล่าสุด) */
async function getMyTenantId(userId) {
  const [[t]] = await db.query(
    `SELECT tenant_id
       FROM tenants
      WHERE user_id = ?
      ORDER BY checkin_date DESC
      LIMIT 1`,
    [userId]
  );
  return t?.tenant_id || null;
}

/* ============================
 * GET: รายการแจ้งเตือนทั้งหมดของ tenant
 * ============================ */
router.get('/tenant/notifications', verifyToken, async (req, res) => {
  try {
    const tenantId = await getMyTenantId(req.user.id);
    if (!tenantId) return res.json([]);

    const [rows] = await db.query(
      `SELECT id, tenant_id, type, title, body, ref_type, ref_id, status, created_at, read_at
         FROM notifications
        WHERE tenant_id = ?
        ORDER BY created_at DESC, id DESC`,
      [tenantId]
    );
    res.json(rows);
  } catch (e) {
    console.error('list notifications error:', e);
    res.status(500).json({ error: 'internal error' });
  }
});

/* ============================
 * PATCH: ทำเป็นอ่านแล้ว (ทีละรายการ)
 * ============================ */
router.patch('/tenant/notifications/:id/read', verifyToken, async (req, res) => {
  try {
    const tenantId = await getMyTenantId(req.user.id);
    if (!tenantId) return res.status(404).json({ error: 'tenant not found' });

    const [r] = await db.query(
      `UPDATE notifications
          SET status='read', read_at=NOW()
        WHERE id=? AND tenant_id=?`,
      [req.params.id, tenantId]
    );
    if (!r.affectedRows) return res.status(404).json({ error: 'notification not found' });
    res.json({ ok: true, updated: r.affectedRows });
  } catch (e) {
    console.error('read one notif error:', e);
    res.status(500).json({ error: 'internal error' });
  }
});

/* ============================
 * PATCH: ทำเป็นอ่านแล้วทั้งหมด (เฉพาะของตัวเอง)
 * ============================ */
router.patch('/tenant/notifications/read-all', verifyToken, async (req, res) => {
  try {
    const tenantId = await getMyTenantId(req.user.id);
    if (!tenantId) return res.json({ ok: true, updated: 0 });

    const [r] = await db.query(
      `UPDATE notifications
          SET status='read', read_at=NOW()
        WHERE tenant_id=? AND status='unread'`,
      [tenantId]
    );
    res.json({ ok: true, updated: r.affectedRows || 0 });
  } catch (e) {
    console.error('read-all notif error:', e);
    res.status(500).json({ error: 'internal error' });
  }
});

/* ============================
 * DELETE: ล้างเฉพาะรายการที่ "อ่านแล้ว"
 * ============================ */
router.delete('/tenant/notifications/clear-read', verifyToken, async (req, res) => {
  try {
    const tenantId = await getMyTenantId(req.user.id);
    if (!tenantId) return res.json({ ok: true, deleted: 0 });

    const [r] = await db.query(
      `DELETE FROM notifications
        WHERE tenant_id=? AND status='read'`,
      [tenantId]
    );
    res.json({ ok: true, deleted: r.affectedRows || 0 });
  } catch (e) {
    console.error('clear-read notif error:', e);
    res.status(500).json({ error: 'internal error' });
  }
});

/* ============================
 * (เสริม) DELETE: ลบทีละรายการของตัวเอง
 * ============================ */
router.delete('/tenant/notifications/:id', verifyToken, async (req, res) => {
  try {
    const tenantId = await getMyTenantId(req.user.id);
    if (!tenantId) return res.status(404).json({ error: 'tenant not found' });

    const [r] = await db.query(
      `DELETE FROM notifications
        WHERE id=? AND tenant_id=?`,
      [req.params.id, tenantId]
    );
    if (!r.affectedRows) return res.status(404).json({ error: 'notification not found' });
    res.json({ ok: true, deleted: r.affectedRows });
  } catch (e) {
    console.error('delete one notif error:', e);
    res.status(500).json({ error: 'internal error' });
  }
});

module.exports = router;
