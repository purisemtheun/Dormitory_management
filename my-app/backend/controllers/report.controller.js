// controllers/reports.controller.js
const pool = require('../config/db'); // mysql2/promise pool

// utility
const toYM = (d = new Date()) => d.toISOString().slice(0, 7);
const mapRows = (rows) => rows.map(r => ({ ...r }));

/* -------------------------- 1) Rooms status -------------------------- */
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
      ORDER BY r.room_number+0, r.room_number
    `);
    res.json(mapRows(rows));
  } catch (err) {
    next(err);
  }
};

/* --------- 2) Payments / Revenue / Debts (ตามที่หน้าอื่นเรียก) ---------- */
exports.getPayments = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: 'from and to are required (YYYY-MM-DD)' });

    const [rows] = await pool.query(
      `
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
      `,
      [from, to]
    );

    res.json(mapRows(rows));
  } catch (err) {
    next(err);
  }
};

exports.getRevenue = async (req, res, next) => {
  try {
    const { granularity = 'monthly', from, to, months = 6 } = req.query;

    if (granularity === 'daily') {
      if (!from || !to) return res.status(400).json({ error: 'from and to are required for daily' });

      const [rows] = await pool.query(
        `
        SELECT DATE(p.payment_date) AS period,
               SUM(p.amount) AS revenue,
               COUNT(*) AS paid
        FROM payments p
        WHERE DATE(p.payment_date) BETWEEN ? AND ?
        GROUP BY DATE(p.payment_date)
        ORDER BY period
        `,
        [from, to]
      );
      return res.json(mapRows(rows));
    }

    const [rows] = await pool.query(
      `
      SELECT DATE_FORMAT(p.payment_date, '%Y-%m') AS period,
             SUM(p.amount) AS revenue,
             COUNT(*) AS paid
      FROM payments p
      WHERE p.payment_date >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
      GROUP BY DATE_FORMAT(p.payment_date, '%Y-%m')
      ORDER BY period
      `,
      [Number(months)]
    );
    res.json(mapRows(rows));
  } catch (err) {
    next(err);
  }
};

exports.getDebts = async (req, res, next) => {
  try {
    const asOf = req.query.asOf || new Date().toISOString().slice(0, 10);
    const [rows] = await pool.query(
      `
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
      `,
      [asOf]
    );
    res.json(mapRows(rows));
  } catch (err) {
    next(err);
  }
};

/* ------------------- 3) Utilities (วิธี B: ใช้หน่วย/เรท) ------------------- */
/* GET /api/reports/meter-monthly?ym=YYYY-MM
   - ดึงทุกห้อง + ค่าที่กรอกไว้ของเดือนนั้น
   - คำนวณ water_cost, electric_cost, total_cost ให้หน้า UI ใช้ทันที
*/
// controllers/report.controller.js (หรือที่คุณวางฟังก์ชัน meterMonthly ไว้)
exports.getMeterMonthly = async (req, res, next) => {
  try {
    const ym = req.query.ym; // 'YYYY-MM'
    if (!ym) return res.status(400).json({ error: "ym (YYYY-MM) is required" });

    const [rows] = await db.query(
      `
      SELECT
        r.room_id,
        r.room_number,
        u.name AS tenant_name,

        -- น้ำ
        COALESCE(cur.water_prev,
                 (SELECT m2.water_curr
                  FROM meter_readings m2
                  WHERE m2.room_id = r.room_id
                    AND m2.period_ym < ?
                  ORDER BY m2.period_ym DESC
                  LIMIT 1),
                 0) AS water_prev,

        COALESCE(cur.water_curr, 0) AS water_curr,

        -- ไฟ
        COALESCE(cur.electric_prev,
                 (SELECT m3.electric_curr
                  FROM meter_readings m3
                  WHERE m3.room_id = r.room_id
                    AND m3.period_ym < ?
                  ORDER BY m3.period_ym DESC
                  LIMIT 1),
                 0) AS electric_prev,

        COALESCE(cur.electric_curr, 0) AS electric_curr,

        COALESCE(cur.water_rate,    18.00) AS water_rate,
        COALESCE(cur.electric_rate,  6.50) AS electric_rate,
        COALESCE(cur.rent_amount, r.price, 0) AS rent_amount,

        -- ถ้าคุณมีคอลัมน์ flat_xxx ก็ select มาด้วยได้
        cur.flat_water_amount,
        cur.flat_electric_amount,
        cur.billing_mode

      FROM rooms r
      LEFT JOIN tenants  t ON t.room_id = r.room_id AND t.is_deleted = 0
      LEFT JOIN users    u ON u.id      = t.user_id
      LEFT JOIN meter_readings cur
             ON cur.room_id = r.room_id
            AND cur.period_ym = ?
      ORDER BY r.room_number
      `,
      [ym, ym, ym] // ถูกใช้งาน 3 จุดใน query ด้านบน
    );

    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
};


/* POST /api/reports/meter-reading
   body: { id?, period_ym, room_id, water_units, electric_units, water_rate, electric_rate, rent_amount, note }
   - มี id -> UPDATE
   - ไม่มี id -> ถ้ามี (room_id, period_ym) อยู่แล้วให้ UPDATE, ถ้าไม่มีก็ INSERT
*/
exports.saveMeterReading = async (req, res, next) => {
  try {
    const {
      id,
      period_ym,
      room_id,
      water_units,
      electric_units,
      water_rate,
      electric_rate,
      rent_amount,
      note
    } = req.body;

    if (!period_ym || !room_id) {
      return res.status(400).json({ error: 'period_ym and room_id are required' });
    }

    const wUnits = water_units ?? 0;
    const eUnits = electric_units ?? 0;
    const wRate  = water_rate   ?? 18.00;
    const eRate  = electric_rate?? 6.50;

    if (id) {
      await pool.query(
        `
        UPDATE meter_readings
          SET water_units=?,
              electric_units=?,
              water_rate=?,
              electric_rate=?,
              rent_amount=?,
              note=?
        WHERE id=?
        `,
        [wUnits, eUnits, wRate, eRate, rent_amount ?? null, note ?? null, id]
      );
      return res.json({ ok: true, id });
    }

    // ไม่มี id -> เช็คก่อนว่ามีแถวของ (room_id, period_ym) หรือยัง
    const [exist] = await pool.query(
      `SELECT id FROM meter_readings WHERE room_id=? AND period_ym=? LIMIT 1`,
      [room_id, period_ym]
    );

    if (exist.length) {
      await pool.query(
        `
        UPDATE meter_readings
          SET water_units=?,
              electric_units=?,
              water_rate=?,
              electric_rate=?,
              rent_amount=?,
              note=?
        WHERE id=?
        `,
        [wUnits, eUnits, wRate, eRate, rent_amount ?? null, note ?? null, exist[0].id]
      );
      return res.json({ ok: true, id: exist[0].id });
    }

    // แทรกใหม่
    const [ins] = await pool.query(
      `
      INSERT INTO meter_readings
        (room_id, period_ym, water_units, electric_units, water_rate, electric_rate, rent_amount, note)
      VALUES (?,?,?,?,?,?,?,?)
      `,
      [room_id, period_ym, wUnits, eUnits, wRate, eRate, rent_amount ?? null, note ?? null]
    );
    res.json({ ok: true, id: ins.insertId });
  } catch (err) {
    next(err);
  }
};
