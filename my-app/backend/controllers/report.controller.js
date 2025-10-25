const pool = require('../config/db'); // mysql2/promise pool

// helper: สรุป array จากผล query
const mapRows = (rows) => rows.map(r => ({ ...r }));

// 1) Rooms status
exports.getRoomsStatus = async (req, res, next) => {
  try {
    const [rows] = await pool.query(`
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
    res.json({ data: mapRows(rows) });
  } catch (err) {
    next(err);
  }
};

// 2) Utilities summary (from/to YYYY-MM-DD)
exports.getUtilities = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: 'from and to are required (YYYY-MM-DD)' });

    const [rows] = await pool.query(`
      SELECT
        r.room_number AS roomNo,
        SUM(m.water_curr - m.water_prev)       AS waterUnits,
        SUM(m.electric_curr - m.electric_prev) AS electricUnits,
        SUM((m.water_curr - m.water_prev) * m.water_rate)         AS waterCharge,
        SUM((m.electric_curr - m.electric_prev) * m.electric_rate) AS electricCharge
      FROM meter_readings m
      JOIN rooms r ON r.room_id = m.room_id
      WHERE m.reading_date BETWEEN ? AND ?
      GROUP BY r.room_number
      ORDER BY r.room_number
    `, [from, to]);

    res.json({ data: rows.map(x => ({
      roomNo: x.roomNo,
      waterUnits: Number(x.waterUnits || 0),
      electricUnits: Number(x.electricUnits || 0),
      waterCharge: Number(x.waterCharge || 0),
      electricCharge: Number(x.electricCharge || 0),
    }))});
  } catch (err) {
    next(err);
  }
};

// 3) Debts as of date
exports.getDebts = async (req, res, next) => {
  try {
    const asOf = req.query.asOf || new Date().toISOString().slice(0,10);
    const [rows] = await pool.query(`
      SELECT
        i.invoice_no     AS invoiceNo,
        r.room_number    AS roomNo,
        u.name           AS tenant,
        i.amount,
        GREATEST(DATEDIFF(?, i.due_date),0) AS daysOverdue
      FROM invoices i
      JOIN rooms   r ON r.room_id = i.room_id
      JOIN tenants t ON t.tenant_id = i.tenant_id AND t.is_deleted = 0
      JOIN users   u ON u.id = t.user_id
      WHERE UPPER(i.status) IN ('UNPAID','OVERDUE')
      ORDER BY daysOverdue DESC, roomNo
    `, [asOf]);
    res.json({ data: mapRows(rows) });
  } catch (err) {
    next(err);
  }
};

// 4) Payments within [from,to]
exports.getPayments = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: 'from and to are required (YYYY-MM-DD)' });

    const [rows] = await pool.query(`
      SELECT
        DATE(p.payment_date) AS date,
        i.invoice_no         AS invoiceNo,
        u.name               AS tenant,
        p.amount,
        p.status             AS payStatus
      FROM payments p
      JOIN invoices i ON i.id = p.invoice_id
      JOIN tenants  t ON t.tenant_id = i.tenant_id AND t.is_deleted = 0
      JOIN users    u ON u.id = t.user_id
      WHERE DATE(p.payment_date) BETWEEN ? AND ?
      ORDER BY date, invoiceNo
    `, [from, to]);

    res.json({ data: mapRows(rows) });
  } catch (err) {
    next(err);
  }
};

// 5) Revenue summary (monthly or daily)
exports.getRevenue = async (req, res, next) => {
  try {
    const { granularity = 'monthly', from, to, months = 6 } = req.query;

    if (granularity === 'daily') {
      if (!from || !to) return res.status(400).json({ error: 'from and to are required for daily' });
      const [rows] = await pool.query(`
        SELECT DATE(p.payment_date) AS period,
               SUM(p.amount) AS revenue,
               COUNT(*) AS paid
        FROM payments p
        WHERE DATE(p.payment_date) BETWEEN ? AND ?
        GROUP BY DATE(p.payment_date)
        ORDER BY period
      `, [from, to]);
      return res.json({ data: mapRows(rows) });
    }

    // monthly
    const [rows] = await pool.query(`
      SELECT DATE_FORMAT(p.payment_date, '%Y-%m') AS period,
             SUM(p.amount) AS revenue,
             COUNT(*) AS paid
      FROM payments p
      WHERE p.payment_date >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
      GROUP BY DATE_FORMAT(p.payment_date, '%Y-%m')
      ORDER BY period
    `, [Number(months)]);
    res.json({ data: mapRows(rows) });
  } catch (err) {
    next(err);
  }
};
