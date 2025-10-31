const pool = require("../config/db");

/** utils */
const asArray = (rows) => (Array.isArray(rows) ? rows : []);

/* ========================= 1) Rooms Status ========================= */
exports.getRoomsStatus = async (_req, res, next) => {
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
        COALESCE(u.name, u.fullname) AS tenant
      FROM rooms r
      LEFT JOIN tenants t ON t.room_id = r.room_id AND t.is_deleted = 0
      LEFT JOIN users   u ON u.id = t.user_id
      ORDER BY r.room_number+0, r.room_number
    `);
    res.json(asArray(rows));
  } catch (err) { next(err); }
};

/* ========================= 2) Revenue (รวม endpoint เดิมสำหรับความเข้ากันได้) ========================= */
exports.getRevenue = async (req, res, next) => {
  try {
    const { granularity = "monthly", from, to, months = 6 } = req.query;

    if (granularity === "daily") {
      if (!from || !to) {
        return res.status(400).json({ error: "from and to are required (YYYY-MM-DD)" });
      }
      const [rows] = await pool.query(
        `
        SELECT
          DATE(COALESCE(i.paid_at, p.payment_date)) AS period,
          SUM(p.amount)                               AS revenue,
          COUNT(*)                                    AS paid
        FROM payments p
        LEFT JOIN invoices i ON i.id = p.invoice_id
        WHERE COALESCE(i.paid_at, p.payment_date) BETWEEN ? AND ?
          AND p.status = 'approved'
        GROUP BY period
        ORDER BY period
        `,
        [`${from} 00:00:00`, `${to} 23:59:59`]
      );
      return res.json(asArray(rows));
    }

    // monthly (จาก payments อนุมัติแล้ว) — คงไว้เพื่อหน้าที่เคยใช้เส้นนี้
    const [rows] = await pool.query(
      `
      SELECT DATE_FORMAT(p.payment_date, '%Y-%m') AS period,
             SUM(p.amount) AS revenue,
             COUNT(*)      AS paid
      FROM payments p
      WHERE p.payment_date >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
        AND p.status = 'approved'
      GROUP BY DATE_FORMAT(p.payment_date, '%Y-%m')
      ORDER BY period
      `,
      [Number(months)]
    );
    res.json(asArray(rows));
  } catch (err) { next(err); }
};

/* ========================= 2.1) Revenue Daily (endpoint ใหม่, ชัดเจนขึ้น) ========================= */
exports.getRevenueDaily = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) {
      return res.status(400).json({ error: "from and to are required (YYYY-MM-DD)" });
    }
    const [rows] = await pool.query(
      `
      SELECT
        DATE(COALESCE(i.paid_at, p.payment_date)) AS date,
        SUM(p.amount)                               AS revenue,
        COUNT(*)                                    AS paid
      FROM payments p
      LEFT JOIN invoices i ON i.id = p.invoice_id
      WHERE COALESCE(i.paid_at, p.payment_date) BETWEEN ? AND ?
        AND p.status = 'approved'
      GROUP BY DATE(COALESCE(i.paid_at, p.payment_date))
      ORDER BY date ASC
      `,
      [`${from} 00:00:00`, `${to} 23:59:59`]
    );
    res.json(asArray(rows));
  } catch (err) { next(err); }
};

exports.getPayments = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) {
      return res.status(400).json({ error: "from and to are required (YYYY-MM-DD)" });
    }

    // ช่วงเวลาครอบคลุมทั้งวันแบบ inclusive
    const dfrom = `${from} 00:00:00`;
    const dto   = `${to} 23:59:59`;

    // A) ยอดจาก payments ที่อนุมัติแล้ว (approved) — ใช้วันที่จ่าย p.payment_date
    // B) ยอดจาก invoices ที่สถานะ paid — ใช้วันที่ i.paid_at
    // ใช้ COALESCE เพื่อให้ได้วัน-ห้อง-ผู้ชำระครบ และรวมผลด้วย UNION ALL
    const sql = `
      SELECT
        COALESCE(i.paid_at, p.payment_date)             AS paid_at,
        r.room_id,
        r.room_number,
        i.invoice_no,
        /* amount ให้มาก่อนจาก payments ถ้ามี ไม่งั้นใช้ยอดรวมทั้งบิล */
        COALESCE(p.amount, i.amount, 0)                 AS amount,
        COALESCE(u.fullname, u.name)                    AS tenant_name,
        /* แปลงสถานะเป็น label ไทย */
        CASE
          WHEN p.status = 'approved' OR i.status='paid' THEN 'approved'
          WHEN p.status = 'pending'  THEN 'pending'
          WHEN p.status = 'rejected' THEN 'rejected'
          ELSE COALESCE(p.status, i.status)
        END                                             AS payment_status
      FROM payments p
        JOIN invoices  i ON i.id = p.invoice_id
        LEFT JOIN tenants t ON t.tenant_id = i.tenant_id
        LEFT JOIN users   u ON u.id      = t.user_id
        LEFT JOIN rooms   r ON r.room_id = i.room_id
      WHERE p.status = 'approved'
        AND COALESCE(i.paid_at, p.payment_date) BETWEEN ? AND ?
      
      UNION ALL

      SELECT
        i.paid_at                                      AS paid_at,
        r.room_id,
        r.room_number,
        i.invoice_no,
        i.amount                                       AS amount,
        COALESCE(u.fullname, u.name)                   AS tenant_name,
        'approved'                                     AS payment_status
      FROM invoices i
        LEFT JOIN tenants t ON t.tenant_id = i.tenant_id
        LEFT JOIN users   u ON u.id      = t.user_id
        LEFT JOIN rooms   r ON r.room_id = i.room_id
      WHERE i.status = 'paid'
        AND i.paid_at BETWEEN ? AND ?
        /* กันไม่ให้ซ้ำกับบิลที่มี payments อนุมัติแล้ว */
        AND NOT EXISTS (
          SELECT 1 FROM payments p2
          WHERE p2.invoice_id = i.id AND p2.status = 'approved'
        )
      ORDER BY paid_at DESC, room_number+0, room_number
    `;

    const [rows] = await pool.query(sql, [dfrom, dto, dfrom, dto]);
    res.json(Array.isArray(rows) ? rows : []);
  } catch (err) {
    next(err);
  }
};

/* ========================= 4) Debts ========================= */
exports.getDebts = async (req, res, next) => {
  try {
    const asOf = req.query.asOf || new Date().toISOString().slice(0, 10);
    const [rows] = await pool.query(
      `
      SELECT
        i.invoice_no                         AS invoiceNo,
        r.room_number                        AS roomNo,
        COALESCE(u.fullname, u.name, u.email, CONCAT('Tenant#', i.tenant_id)) AS tenant,
        -- ยอดแยกหมวด
        COALESCE(i.rent_amount,     0)       AS rent_amount,
        COALESCE(i.water_amount,    0)       AS water_amount,
        COALESCE(i.electric_amount, 0)       AS electric_amount,
        COALESCE(i.amount,          0)       AS total_amount,
        -- อายุหนี้
        GREATEST(DATEDIFF(?, i.due_date), 0) AS daysOverdue
      FROM invoices i
      JOIN rooms   r ON r.room_id   = i.room_id
      JOIN tenants t ON t.tenant_id = i.tenant_id AND COALESCE(t.is_deleted,0) = 0
      LEFT JOIN users   u ON u.id   = t.user_id
      WHERE UPPER(i.status) IN ('UNPAID','OVERDUE')
      ORDER BY daysOverdue DESC, r.room_number+0, r.room_number
      `,
      [asOf]
    );
    res.json(asArray(rows));
  } catch (err) { next(err); }
};

/* ========================= 5) Utilities (ค่าน้ำ/ไฟ ต่อห้อง) ========================= */
exports.getMeterMonthlySimple = async (req, res, next) => {
  try {
    const period_ym = req.query.period_ym || req.query.ym;
    if (!period_ym) return res.status(400).json({ error: "period_ym (YYYY-MM) is required" });

    const [rows] = await pool.query(
      `
      SELECT
        r.room_id,
        r.room_number,
        COALESCE(u.name, u.fullname, '-') AS tenant_name,
        ? AS period_ym,
        COALESCE(m.water_units, 0)    AS water_units,
        COALESCE(m.electric_units, 0) AS electric_units,
        COALESCE(m.water_rate, 7)     AS water_rate,
        COALESCE(m.electric_rate, 7)  AS electric_rate,
        COALESCE(m.is_locked, 0)      AS is_locked
      FROM rooms r
      LEFT JOIN tenants t ON t.room_id = r.room_id AND t.is_deleted = 0
      LEFT JOIN users   u ON u.id      = t.user_id
      LEFT JOIN meter_readings m
        ON m.room_id = r.room_id
       AND m.period_ym = ?
      ORDER BY CAST(r.room_number AS UNSIGNED), r.room_number
      `,
      [period_ym, period_ym]
    );

    res.json(asArray(rows));
  } catch (err) { next(err); }
};

exports.saveMeterSimple = async (req, res, next) => {
  try {
    const {
      room_id,
      period_ym,
      water_units = 0,
      electric_units = 0,
      water_rate = 7,
      electric_rate = 7,
    } = req.body || {};

    if (!room_id || !period_ym) {
      return res.status(400).json({ error: "room_id & period_ym required" });
    }

    const readingDate = (() => {
      const d = new Date(`${period_ym}-01T00:00:00`);
      d.setMonth(d.getMonth() + 1);
      d.setDate(0);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    })();

    const [[cur]] = await pool.query(
      `SELECT is_locked FROM meter_readings WHERE room_id=? AND period_ym=?`,
      [room_id, period_ym]
    );
    if (cur && Number(cur.is_locked) === 1) {
      return res.status(400).json({ error: "รายการนี้ถูกล็อกแล้ว" });
    }

    await pool.query(
      `
      INSERT INTO meter_readings
        (room_id, period_ym, reading_date, water_units, electric_units, water_rate, electric_rate, is_locked)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0)
      ON DUPLICATE KEY UPDATE
        reading_date   = VALUES(reading_date),
        water_units    = VALUES(water_units),
        electric_units = VALUES(electric_units),
        water_rate     = VALUES(water_rate),
        electric_rate  = VALUES(electric_rate)
      `,
      [room_id, period_ym, readingDate, water_units, electric_units, water_rate, electric_rate]
    );

    const [[row]] = await pool.query(
      `SELECT * FROM meter_readings WHERE room_id=? AND period_ym=?`,
      [room_id, period_ym]
    );
    res.json(row || { ok: true });
  } catch (err) { next(err); }
};

exports.toggleMeterLock = async (req, res, next) => {
  try {
    const { room_id, period_ym, lock } = req.body || {};
    if (!room_id || !period_ym) {
      return res.status(400).json({ error: "room_id & period_ym required" });
    }

    await pool.query(
      `
      INSERT INTO meter_readings (room_id, period_ym, is_locked)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE is_locked = VALUES(is_locked)
      `,
      [room_id, period_ym, lock ? 1 : 0]
    );

    res.json({ ok: true, is_locked: !!lock });
  } catch (err) { next(err); }
};

/* ========================= 6) รายเดือน (อิงใบแจ้งหนี้ + ยอดที่เก็บแล้ว) ========================= */
exports.monthlySummary = async (req, res, next) => {
  try {
    // จำนวนเดือนย้อนหลัง (1–24)
    const months = Math.max(1, Math.min(24, Number(req.query.months || 6)));

    // อธิบายแนวคิด:
    //  - billed: sum จาก invoices (rent_amount, water_amount, electric_amount, amount)
    //  - collected: sum จาก payments ที่ status='approved' (รวมต่อใบ) -> รวมต่อเดือน
    //    หมายเหตุ: ไม่มีการเก็บยอดแยกประเภทตอนชำระ จึงให้ rent_collected/water_collected/electric_collected = 0
    //    และคืน total_collected เพียงค่าเดียว เพื่อให้ฝั่ง UI fallback ไปใช้ billed รายประเภท (โค้ด UI ทำไว้แล้ว)

    const sql = `
      SELECT
        i.period_ym,

        /* ===== billed (จาก invoices) ===== */
        SUM(COALESCE(i.rent_amount,    0)) AS rent_amount,
        SUM(COALESCE(i.water_amount,   0)) AS water_amount,
        SUM(COALESCE(i.electric_amount,0)) AS electric_amount,
        SUM(COALESCE(i.amount,         0)) AS total_amount,

        /* จำนวนห้องที่มีการวางบิลในเดือนนั้น */
        COUNT(DISTINCT i.room_id)          AS rooms_count,

        /* ===== collected (จาก payments อนุมัติแล้ว) ===== */
        0                                   AS rent_collected,
        0                                   AS water_collected,
        0                                   AS electric_collected,
        SUM(COALESCE(paid.paid_amount, 0))  AS total_collected

      FROM invoices i

      /* รวมยอดชำระต่อใบที่ได้รับการอนุมัติแล้ว */
      LEFT JOIN (
        SELECT invoice_id, SUM(amount) AS paid_amount
        FROM payments
        WHERE status = 'approved'
        GROUP BY invoice_id
      ) AS paid
        ON paid.invoice_id = i.id

      /* จำกัดช่วงเดือนย้อนหลังโดยอิงจาก period_ym ของใบแจ้งหนี้ */
      WHERE i.period_ym >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL ? MONTH), '%Y-%m')

      GROUP BY i.period_ym
      ORDER BY i.period_ym DESC
      LIMIT ?
    `;

    // อธิบาย param:
    //  - ใช้ months เดียวกันทั้ง filter และ limit เพื่อกันข้อมูลเกินช่วง
    const [rows] = await pool.query(sql, [Number(months), Number(months)]);
    return res.json(asArray(rows));
  } catch (err) { next(err); }
};


/* ========================= 7) แตกห้องรายเดือน ========================= */
exports.monthlyBreakdown = async (req, res, next) => {
  try {
    const period_ym = req.params.ym;
    const [rows] = await pool.query(
      `
      SELECT
        v.room_id,
        v.rent_amount,
        v.water_amount,
        v.electric_amount,
        (v.rent_amount + v.water_amount + v.electric_amount) AS total_amount
      FROM v_meter_charges v
      WHERE v.period_ym = ?
      ORDER BY total_amount DESC
      `,
      [period_ym]
    );
    res.json(asArray(rows));
  } catch (err) {
    // fallback กรณีไม่มี view
    try {
      const period_ym = req.params.ym;
      const [rows] = await pool.query(
        `
        SELECT
          m.room_id,
          r.price                                                     AS rent_amount,
          COALESCE(m.water_units,0)    * COALESCE(m.water_rate,0)    AS water_amount,
          COALESCE(m.electric_units,0) * COALESCE(m.electric_rate,0) AS electric_amount,
          (
            r.price
            + COALESCE(m.water_units,0)    * COALESCE(m.water_rate,0)
            + COALESCE(m.electric_units,0) * COALESCE(m.electric_rate,0)
          ) AS total_amount
        FROM meter_readings m
        JOIN rooms r ON r.room_id = m.room_id
        WHERE m.period_ym = ?
        ORDER BY total_amount DESC
        `,
        [period_ym]
      );
      res.json(asArray(rows));
    } catch (e2) { next(err); }
  }
};
