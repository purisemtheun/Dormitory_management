// backend/controllers/adminController.js
const db = require('../config/db');

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_BASE_URL =
  (process.env.PUBLIC_BASE_URL && process.env.PUBLIC_BASE_URL.replace(/\/+$/, '')) ||
  `http://localhost:${PORT}`;

/**
 * GET /api/admin/invoices/pending
 * แสดงใบแจ้งหนี้สถานะ unpaid/pending พร้อมชื่อผู้เช่า และ URL สลิปแบบ absolute
 */
async function getPendingInvoices(_req, res) {
  try {
    const [rows] = await db.query(`
      SELECT
        i.id        AS invoice_id,
        i.tenant_id,
        t.room_id   AS tenant_room,
        i.period_ym,
        i.amount,
        i.status,
        i.due_date,
        i.paid_at,
        i.slip_url,
        COALESCE(u.name, CONCAT('Tenant#', i.tenant_id)) AS tenant_name
      FROM invoices i
      LEFT JOIN tenants t ON t.tenant_id = i.tenant_id
      LEFT JOIN users   u ON u.id       = t.user_id
      WHERE i.status IN ('pending','unpaid')
      ORDER BY i.created_at DESC, i.id DESC
    `);

   const data = rows.map((r) => {
  const p = r.slip_url || null;
  const abs = p ? `${PUBLIC_BASE_URL}${encodeURI(p)}` : null;
  return { ...r, slip_abs: abs };
});
    res.json(data);
  } catch (e) {
    console.error('getPendingInvoices error:', e);
    res.status(500).json({ error: e.message || 'Internal error' });
  }
}

/**
 * POST /api/admin/invoices
 */
async function createInvoice(req, res) {
  try {
    const { tenant_id, period_ym, amount, due_date } = req.body || {};
    if (!tenant_id || !period_ym || typeof amount === 'undefined') {
      return res.status(400).json({ error: 'tenant_id, period_ym, amount required' });
    }

    const [trows] = await db.query(
      `SELECT tenant_id, room_id
         FROM tenants
        WHERE tenant_id = ?
          AND (is_deleted = 0 OR is_deleted IS NULL)
        LIMIT 1`,
      [tenant_id]
    );
    if (!trows.length) return res.status(400).json({ error: 'tenant not found' });

    const room_id = trows[0].room_id || null;

    const [result] = await db.query(
      `INSERT INTO invoices (tenant_id, room_id, period_ym, amount, due_date, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'unpaid', NOW())`,
      [tenant_id, room_id, period_ym, amount, due_date]
    );

    res.status(201).json({ ok: true, invoice_id: result.insertId });
  } catch (e) {
    console.error('createInvoice error:', e);
    res.status(500).json({ error: e.message || 'Internal error' });
  }
}

/**
 * POST /api/admin/invoices/generate-month
 */
async function generateMonth(req, res) {
  const { period_ym, amount_default } = req.body || {};
  const month = period_ym || new Date().toISOString().slice(0, 7);

  try {
    const [tenants] = await db.query(
      `SELECT t.tenant_id, t.room_id, r.price
         FROM tenants t
         LEFT JOIN rooms r ON r.room_id = t.room_id
        WHERE (t.is_deleted = 0 OR t.is_deleted IS NULL)
          AND NOT EXISTS (
            SELECT 1 FROM invoices i
             WHERE i.tenant_id = t.tenant_id AND i.period_ym = ?
          )`,
      [month]
    );

    if (!tenants.length) return res.json({ ok: true, created: 0, skipped: 0 });

    let createdCount = 0;
    for (const t of tenants) {
      const amt = amount_default ?? t.price ?? 0;
      await db.query(
        `INSERT INTO invoices (tenant_id, room_id, period_ym, amount, status, created_at)
         VALUES (?, ?, ?, ?, 'unpaid', NOW())`,
        [t.tenant_id, t.room_id, month, amt]
      );
      createdCount++;
    }

    res.json({ ok: true, created: createdCount, skipped: 0 });
  } catch (e) {
    console.error('generateMonth error:', e);
    res.status(500).json({ error: e.message || 'Internal error' });
  }
}

/**
 * PATCH /api/admin/invoices/:id/decision
 */
async function decideInvoice(req, res) {
  try {
    const invoiceId = req.params.id;
    const { action } = req.body;

    if (!invoiceId || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'invalid input' });
    }

    let newStatus, paidAt = null;
    if (action === 'approve') {
      newStatus = 'paid';
      paidAt = new Date();
    } else {
      newStatus = 'rejected';
    }

    const [result] = await db.query(
      `UPDATE invoices
          SET status = ?,
              paid_at = ?,
              updated_at = NOW()
        WHERE id = ?`,
      [newStatus, paidAt, invoiceId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'invoice not found' });
    }

    res.json({
      ok: true,
      invoice_id: invoiceId,
      status: newStatus,
      message: action === 'approve' ? 'อนุมัติการชำระเงินแล้ว' : 'ปฏิเสธการชำระเงินแล้ว',
    });
  } catch (e) {
    console.error('decideInvoice error:', e);
    res.status(500).json({ error: e.message || 'Internal error' });
  }
}

module.exports = {
  getPendingInvoices,
  createInvoice,
  generateMonth,
  decideInvoice,
};
