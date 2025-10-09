// routes/tenant.notifications.js
const express = require('express');
const db = require('../config/db.js');
const { requireTenant } = require('../middlewares/auth');

const router = express.Router();
router.use(requireTenant);

// GET /api/tenant/notifications – แสดงแจ้งเตือนของผู้เช่า
router.get('/notifications', async (req, res, next) => {
  try {
    const tenantId = req.user.tenant_id;
    const [rows] = await db.query(
      `SELECT id,type,title,body,ref_type,ref_id,created_at,read_at
       FROM notifications
       WHERE tenant_id=? ORDER BY id DESC LIMIT 100`,
      [tenantId]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/tenant/notifications/:id/read – ทำเครื่องหมายว่าอ่านแล้ว
router.patch('/notifications/:id/read', async (req, res, next) => {
  try {
    const tenantId = req.user.tenant_id;
    await db.query(
      `UPDATE notifications
       SET read_at=NOW()
       WHERE id=? AND tenant_id=? AND read_at IS NULL`,
      [req.params.id, tenantId]
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
