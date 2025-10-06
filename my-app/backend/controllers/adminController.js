// backend/controllers/adminController.js
const db = require('../config/db');

/**
 * GET /api/admin/invoices/pending
 */
async function getPendingInvoices(_req, res) {
  try {
    const [rows] = await db.query(`
      SELECT
        i.id            AS invoice_id,
        i.tenant_id,
        i.period_ym,
        i.amount,
        i.status,
        i.due_date,
        i.slip_url,
        i.updated_at,
        COALESCE(u.name, CONCAT('Tenant#', i.tenant_id)) AS tenant_name,
        t.room_id AS tenant_room
      FROM invoices i
      LEFT JOIN tenants t ON t.tenant_id = i.tenant_id
      LEFT JOIN users   u ON u.id       = t.user_id
      WHERE i.status = 'pending'
      ORDER BY i.updated_at DESC, i.id DESC
    `);
    return res.json(rows);
  } catch (e) {
    console.error('getPendingInvoices error:', e);
    return res.status(500).json({ error: e.message || 'Internal error' });
  }
}

/**
 * PATCH /api/admin/invoices/:id/decision
 * body { action: 'approve'|'reject' }
 */
async function decideInvoice(req, res) {
  try {
    const invoiceId = req.params.id;
    const { action } = req.body || {};
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: "action ต้องเป็น 'approve' หรือ 'reject'" });
    }
    const nextStatus = action === 'approve' ? 'paid' : 'rejected';

    const [result] = await db.query(
      `UPDATE invoices SET status=?, updated_at=NOW() WHERE id=?`,
      [nextStatus, invoiceId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Invoice not found' });

    const [[row]] = await db.query(`
      SELECT id AS invoice_id, tenant_id, period_ym, amount, status, due_date, slip_url, updated_at
      FROM invoices WHERE id=?`, [invoiceId]);
    return res.json(row);
  } catch (e) {
    console.error('decideInvoice error:', e);
    return res.status(500).json({ error: e.message || 'Internal error' });
  }
}

/**
 * POST /api/admin/invoices
 * body { tenant_id, period_ym, amount, due_date, remark }
 */
async function createInvoice(req, res) {
  try {
    const { tenant_id, period_ym, amount, due_date, remark } = req.body || {};
    if (!tenant_id || !period_ym || typeof amount === 'undefined') {
      return res.status(400).json({ error: 'tenant_id, period_ym, amount required' });
    }

    const [trows] = await db.query('SELECT room_id FROM tenants WHERE tenant_id = ? AND (is_deleted = 0 OR is_deleted IS NULL)', [tenant_id]);
    const room_id = (trows[0] && trows[0].room_id) ? trows[0].room_id : null;

    const [result] = await db.query(
      `INSERT INTO invoices (tenant_id, room_id, period_ym, due_date, amount, status, remark, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'unpaid', ?, NOW(), NOW())`,
      [tenant_id, room_id, period_ym, due_date || `${period_ym}-01`, amount, remark || null]
    );

    return res.status(201).json({ ok: true, invoice_id: result.insertId });
  } catch (e) {
    console.error('createInvoice error:', e);
    return res.status(500).json({ error: e.message || 'Internal error' });
  }
}

/**
 * POST /api/admin/invoices/generate-month
 * body { period_ym, amount_default, due_date }
 */
async function generateMonth(req, res) {
  const { period_ym, amount_default, due_date } = req.body || {};
  const month = period_ym || new Date().toISOString().slice(0,7); // YYYY-MM
  const due = due_date || `${month}-01`;

  try {
    const [tenants] = await db.query(
      `SELECT t.tenant_id, t.room_id, r.price
       FROM tenants t
       LEFT JOIN rooms r ON r.room_id = t.room_id
       WHERE t.is_deleted = 0
       AND NOT EXISTS (SELECT 1 FROM invoices i WHERE i.tenant_id = t.tenant_id AND i.period_ym = ?)`,
      [month]
    );

    if (!tenants.length) return res.json({ ok:true, created:0, skipped:0 });

    const created = [];
    for (const t of tenants) {
      const amt = typeof amount_default !== 'undefined' ? amount_default : (t.price || 0);
      const [result] = await db.query(
        `INSERT INTO invoices (tenant_id, room_id, period_ym, due_date, amount, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'unpaid', NOW(), NOW())`,
        [t.tenant_id, t.room_id, month, due, amt]
      );
      created.push(result.insertId);
    }

    return res.json({ ok: true, created: created.length, skipped: 0 });
  } catch (e) {
    console.error('generateMonth error:', e);
    return res.status(500).json({ error: e.message || 'Internal error' });
  }
}

module.exports = {
  getPendingInvoices,
  decideInvoice,
  createInvoice,
  generateMonth
};
