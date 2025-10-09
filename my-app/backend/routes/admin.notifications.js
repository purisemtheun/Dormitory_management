// routes/admin.notifications.js
const express = require('express');
const db = require('../config/db.js');
const { requireAdmin } = require('../middlewares/auth');

const router = express.Router();
router.use(requireAdmin);

// GET /api/admin/notifications?status=unseen – แจ้งเตือนของแอดมิน
router.get('/notifications', async (req, res, next) => {
  try {
    const status = req.query.status || 'unseen';
    const [rows] = await db.query(
      `SELECT id,type,title,body,ref_type,ref_id,created_at,status
       FROM admin_notifications
       WHERE status=? ORDER BY id DESC LIMIT 100`,
      [status]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/notifications/:id/seen – ทำเครื่องหมายว่าเห็นแล้ว
router.patch('/notifications/:id/seen', async (req, res, next) => {
  try {
    await db.query(
      `UPDATE admin_notifications
       SET status='seen'
       WHERE id=? AND status='unseen'`,
      [req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/payments/pending – รายการสลิปที่รออนุมัติ
router.get('/payments/pending', async (req, res, next) => {
  try {
    const [rows] = await db.query(`
      SELECT i.id AS invoice_id, i.amount, i.status, i.due_date,
             pp.id AS proof_id, pp.file_path, pp.created_at AS uploaded_at,
             i.tenant_id
      FROM payment_proofs pp
      JOIN invoices i ON i.id=pp.invoice_id
      WHERE pp.status='pending'
      ORDER BY pp.id DESC
    `);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
