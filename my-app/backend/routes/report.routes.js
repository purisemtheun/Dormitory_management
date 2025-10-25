// backend/routes/report.routes.js
const express = require('express');

module.exports = (db) => {
  const router = express.Router();

  /* ===================== 1) Rooms status ===================== *
   * ผลลัพธ์: { data: [{roomNo, status, tenant}] }
   */
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
        ORDER BY r.room_number+0, r.room_number
      `);
      res.json({ data: rows });
    } catch (err) { next(err); }
  });

  /* ===================== 2) Revenue ===================== *
   * GET /api/reports/revenue?granularity=monthly&months=6
   * หรือ /api/reports/revenue?granularity=daily&from=YYYY-MM-DD&to=YYYY-MM-DD
   * ผลลัพธ์: { data: [{period, revenue, paid}] }
   */
  router.get('/revenue', async (req, res, next) => {
    try {
      const { granularity = 'monthly', from, to, months = 6 } = req.query;

      if (granularity === 'daily') {
        if (!from || !to) {
          return res.status(400).json({ error: 'from and to are required (YYYY-MM-DD)' });
        }
       const [rows] = await db.query(`
       SELECT
         DATE(COALESCE(i.paid_at, p.payment_date)) AS date,
         SUM(p.amount)                               AS total
        FROM payments p
       LEFT JOIN invoices i ON i.id = p.invoice_id
       WHERE COALESCE(i.paid_at, p.payment_date)
             BETWEEN ? AND ?
         AND p.status = 'approved'
       GROUP BY date
       ORDER BY date
     `, [`${from} 00:00:00`, `${to} 23:59:59`]);
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

  /* ===================== 3) Payments ===================== *
   * GET /api/reports/payments?from=YYYY-MM-DD&to=YYYY-MM-DD
   * ผลลัพธ์: { data: [{date, invoiceNo, tenant, amount, payStatus}] }
   */
router.get("/payments", async (req, res) => {
  try {
    const { from, to } = req.query; // 'YYYY-MM-DD'
    const sql = `
      SELECT
        COALESCE(i.paid_at, p.payment_date)                           AS paid_at,
        i.room_id,
        r.room_number,
        i.invoice_no,
        p.amount,
        COALESCE(u.fullname, u.name)                                   AS tenant_name,
        p.status                                                       AS payment_status,
        CASE
          WHEN p.status = 'approved' THEN 'ชำระเสร็จสิ้น' COLLATE utf8mb4_unicode_ci
          WHEN p.status = 'pending'  THEN 'รอตรวจสอบ'   COLLATE utf8mb4_unicode_ci
          WHEN p.status = 'rejected' THEN 'ปฏิเสธ'       COLLATE utf8mb4_unicode_ci
          ELSE CAST(p.status AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci
        END                                                            AS payment_status_th
      FROM payments p
      JOIN invoices  i ON i.id        = p.invoice_id
      LEFT JOIN tenants t ON t.tenant_id = i.tenant_id
      LEFT JOIN users   u ON u.id      = t.user_id
      LEFT JOIN rooms   r ON r.room_id = i.room_id
      WHERE p.payment_date BETWEEN ? AND ?
        AND p.status IN ('approved','pending','rejected')
      ORDER BY COALESCE(i.paid_at, p.payment_date) DESC
    `;
    const params = [`${from} 00:00:00`, `${to} 23:59:59`];
    const [rows] = await db.query(sql, params);  // เปลี่ยนจาก pool เป็น db
    res.json(rows);
  } catch (err) {
    next(err); // เพิ่ม error handling
  }
});


  /* ===================== 4) Debts (ลูกหนี้ค้าง) ===================== *
   * GET /api/reports/debts?asOf=YYYY-MM-DD
   * ผลลัพธ์: { data: [{invoiceNo, roomNo, tenant, amount, daysOverdue}] }
   */
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

  /* ===================== 5) Utilities – วิธี B ===================== *
   * 5.1) GET /api/reports/meter-monthly?ym=YYYY-MM
   *     ดึงค่าหน่วย/อัตรา/ค่าเช่า และคำนวณยอดน้ำ-ไฟ-รวม ของทุกห้องในเดือนนั้น
   *     ผลลัพธ์: { data: [...] }
   */
  router.get('/meter-monthly', async (req, res, next) => {
    try {
      const ym = req.query.ym;
      if (!ym) return res.status(400).json({ error: 'ym (YYYY-MM) is required' });

      const sql = `
        SELECT
          r.room_id,
          r.room_number AS room_no,
          COALESCE(u.name, '-') AS tenant_name,

          m.reading_date,
          m.water_prev,     m.water_curr,
          m.electric_prev,  m.electric_curr,
          m.water_rate,     m.electric_rate,
          m.rent_amount,

          (m.water_curr    - m.water_prev)    AS water_units,
          (m.electric_curr - m.electric_prev) AS electric_units,
          (m.water_curr    - m.water_prev)    * m.water_rate    AS water_amount,
          (m.electric_curr - m.electric_prev) * m.electric_rate AS electric_amount
        FROM rooms r
        LEFT JOIN meter_readings m
          ON m.room_id = r.room_id
         AND m.period_ym = ?

        /* ผู้เช่าล่าสุดของแต่ละห้อง */
        LEFT JOIN (
          SELECT t.room_id, t.user_id
          FROM tenants t
          JOIN (
            SELECT room_id, MAX(checkin_date) AS last_checkin
            FROM tenants
            WHERE is_deleted = 0
            GROUP BY room_id
          ) x
            ON x.room_id = t.room_id
           AND x.last_checkin = t.checkin_date
          WHERE t.is_deleted = 0
        ) lt
          ON lt.room_id = r.room_id
        LEFT JOIN users u
          ON u.id = lt.user_id

        ORDER BY r.room_number
      `;

      const [rows] = await db.query(sql, [ym]);
      res.json({ data: rows });
    } catch (err) {
      next(err);
    }
  });

  /* ===================== 5.2) POST /api/reports/meter-reading ===================== *
   * body: {
   *   room_id?, room_number?,
   *   period_ym, reading_date?,
   *   mode?, // 'meter' | 'flat' (optional)
   *   water_curr?, electric_curr?,
   *   water_units?, electric_units?, // override เป็น "หน่วย"
   *   water_rate?, electric_rate?,
   *   rent_amount?, note?,
   *   flat_water_amount?, flat_electric_amount? // เผื่อใช้กรณี flat ที่ชั้นอื่น
   * }
   * พฤติกรรม:
   * - ถ้าส่ง *_units มา จะคำนวณ curr = prev + units
   * - ถ้าไม่ส่ง *_units แต่ส่ง *_curr มา จะใช้ curr ตามที่ส่ง
   * - prev จะหาให้อัตโนมัติจากงวดก่อนหน้า (ถ้าไม่ได้ส่ง prev มาด้วย)
   * - Upsert โดย UNIQUE(room_id, period_ym)
   */
  // routes/report.routes.js (หรือ controller ที่รับ meterSaveReading)
router.post('/meter-reading', async (req, res, next) => {
  try {
    const {
      room_id,
      period_ym,            // 'YYYY-MM'
      mode,                 // 'meter'|'flat'
      water_prev,
      water_curr,
      electric_prev,
      electric_curr,
      water_rate,
      electric_rate,
      flat_water_amount,
      flat_electric_amount,
    } = req.body;

    if (!room_id || !period_ym) {
      return res.status(400).json({ error: 'room_id & period_ym required' });
    }

    // ตั้งวันที่อ่านเป็นสิ้นเดือนนั้น (หรือส่งมาจริงก็ใช้ค่าที่ส่ง)
    const reading_date = `${period_ym}-28`; // ใช้ค่าปลอดภัย (หรือคำนวณ last day)

    // Upsert
    await db.query(
      `
      INSERT INTO meter_readings
        (room_id, period_ym, reading_date,
         water_prev, water_curr, electric_prev, electric_curr,
         water_rate, electric_rate,
         flat_water_amount, flat_electric_amount, billing_mode)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
         reading_date = VALUES(reading_date),
         water_prev   = VALUES(water_prev),
         water_curr   = VALUES(water_curr),
         electric_prev= VALUES(electric_prev),
         electric_curr= VALUES(electric_curr),
         water_rate   = VALUES(water_rate),
         electric_rate= VALUES(electric_rate),
         flat_water_amount   = VALUES(flat_water_amount),
         flat_electric_amount= VALUES(flat_electric_amount),
         billing_mode = VALUES(billing_mode)
      `,
      [
        room_id, period_ym, reading_date,
        water_prev ?? null, water_curr ?? null,
        electric_prev ?? null, electric_curr ?? null,
        water_rate ?? null, electric_rate ?? null,
        flat_water_amount ?? null, flat_electric_amount ?? null,
        mode || 'meter'
      ]
    );

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

  return router;
}
