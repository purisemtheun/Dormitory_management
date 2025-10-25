// backend/routes/report.routes.js
const express = require('express');

module.exports = (db) => {
  const router = express.Router();

  // ============ 1) Rooms status ============
  // ผลลัพธ์: { data: [{roomNo, status, tenant}] }
  router.get('/rooms-status', async (_req, res, next) => {
    try {
      const [rows] = await db.query(`
        SELECT
          r.room_number AS roomNo,
          CASE
            WHEN t.tenant_id IS NULL THEN 'VACANT'
            WHEN EXISTS (
              SELECT 1 FROM invoices i
              WHERE i.room_id = r.room_id
                AND UPPER(i.status) IN ('UNPAID','OVERDUE')
            ) THEN 'OVERDUE'
            ELSE 'OCCUPIED'
          END AS status,
          u.name AS tenant
        FROM rooms r
        LEFT JOIN tenants t ON t.room_id = r.room_id AND t.is_deleted = 0
        LEFT JOIN users   u ON u.id = t.user_id
        ORDER BY r.room_number
      `);
      res.json({ data: rows });
    } catch (err) { next(err); }
  });

  // ============ 2) Revenue ============
  // ใช้ตาราง payments (ของจริงคุณมี: invoice_id, payment_date, amount, status)
  // GET /api/reports/revenue?granularity=monthly&months=6
  // หรือ /api/reports/revenue?granularity=daily&from=YYYY-MM-DD&to=YYYY-MM-DD
  router.get('/revenue', async (req, res, next) => {
    try {
      const { granularity = 'monthly', from, to, months = 6 } = req.query;

      if (granularity === 'daily') {
        if (!from || !to) return res.status(400).json({ error: 'from and to are required (YYYY-MM-DD)' });
        const [rows] = await db.query(`
          SELECT DATE(p.payment_date) AS period,
                 SUM(p.amount) AS revenue,
                 COUNT(*) AS paid
          FROM payments p
          WHERE DATE(p.payment_date) BETWEEN ? AND ?
          GROUP BY DATE(p.payment_date)
          ORDER BY period
        `, [from, to]);
        return res.json({ data: rows });
      }

      // monthly
      const [rows] = await db.query(`
        SELECT DATE_FORMAT(p.payment_date, '%Y-%m') AS period,
               SUM(p.amount) AS revenue,
               COUNT(*) AS paid
        FROM payments p
        WHERE p.payment_date >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
        GROUP BY DATE_FORMAT(p.payment_date, '%Y-%m')
        ORDER BY period
      `, [Number(months)]);
      res.json({ data: rows });
    } catch (err) { next(err); }
  });

  // ============ 3) Debts (ลูกหนี้ค้าง) ============
  // ดึงจาก invoices.amount + status = UNPAID/OVERDUE
  // ผลลัพธ์: { data: [{invoiceNo, roomNo, tenant, amount, daysOverdue}] }
  router.get('/debts', async (req, res, next) => {
    try {
      const asOf = req.query.asOf || new Date().toISOString().slice(0,10);
      const [rows] = await db.query(`
        SELECT
          i.invoice_no  AS invoiceNo,
          r.room_number AS roomNo,
          u.name        AS tenant,
          i.amount,
          GREATEST(DATEDIFF(?, i.due_date), 0) AS daysOverdue
        FROM invoices i
        JOIN rooms   r ON r.room_id = i.room_id
        JOIN tenants t ON t.tenant_id = i.tenant_id AND t.is_deleted = 0
        JOIN users   u ON u.id = t.user_id
        WHERE UPPER(i.status) IN ('UNPAID','OVERDUE')
        ORDER BY daysOverdue DESC, roomNo
      `, [asOf]);
      res.json({ data: rows });
    } catch (err) { next(err); }
  });

  return router;
};
