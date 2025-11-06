// backend/controllers/reports.controller.js
"use strict";

const pool = require("../config/db");

/* ---------- tiny helpers ---------- */
const asArray = (rows) => (Array.isArray(rows) ? rows : []);

/* cache โครงสร้างตาราง meter_readings */
let METER_COLS = null;

/** ดึงชื่อคอลัมน์จริงของตาราง meter_readings แล้ว map ให้ใช้ได้หลายสคีมา */
async function getMeterCols() {
  if (METER_COLS) return METER_COLS;

  const [cols] = await pool.query(
    `
    SELECT LOWER(column_name) AS c
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'meter_readings'
    `
  );
  const set = new Set(cols.map((r) => r.c));

  const pick = (...cands) => cands.find((c) => set.has(c)) || null;

  const water_units     = pick("water_units", "water_unit", "water_used", "water_usage", "water");
  const electric_units  = pick("electric_units", "electric_unit", "elec_units", "electric_usage", "electric");
  const water_rate      = pick("water_rate", "rate_water", "w_rate", "water_price", "water_cost");
  const electric_rate   = pick("electric_rate", "rate_electric", "e_rate", "electric_price", "electric_cost");
  const is_locked       = pick("is_locked", "locked", "lock", "islock");
  const period_ym       = pick("period_ym", "period", "month_ym", "billing_ym");
  const reading_date    = pick("reading_date", "read_date", "meter_date", "period_date");

  METER_COLS = {
    water_units, electric_units, water_rate, electric_rate, is_locked, period_ym, reading_date,
  };
  return METER_COLS;
}

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
      LEFT JOIN tenants t ON t.room_id = r.room_id AND COALESCE(t.is_deleted,0) = 0
      LEFT JOIN users   u ON u.id = t.user_id
      ORDER BY r.room_number+0, r.room_number
    `);
  res.json(asArray(rows));
  } catch (err) { next(err); }
};

/* ========================= 2) Revenue (เดิม) ========================= */
exports.getRevenue = async (req, res, next) => {
  try {
    const { granularity = "monthly", from, to, months = 6 } = req.query;

    if (granularity === "daily") {
      if (!from || !to) return res.status(400).json({ error: "from and to are required (YYYY-MM-DD)" });
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

/* ========================= 2.1) Revenue Daily ========================= */
exports.getRevenueDaily = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: "from and to are required (YYYY-MM-DD)" });
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

/* ========================= 3) Payments (แก้ UNION/collation) ========================= */
exports.getPayments = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: "from and to are required (YYYY-MM-DD)" });

    const dtFrom = `${from} 00:00:00`;
    const dtTo   = `${to} 23:59:59`;

    const C = "utf8mb4_unicode_ci";
    const cs = (expr) => `CONVERT(${expr} USING utf8mb4) COLLATE ${C}`;

    const sql = `
      SELECT
        COALESCE(i.paid_at, p.payment_date)            AS paid_at,
        r.room_id                                       AS room_id,
        ${cs("r.room_number")}                          AS room_number,
        ${cs("i.invoice_no")}                           AS invoice_no,
        COALESCE(p.amount, i.amount, 0)                 AS amount,
        ${cs("COALESCE(u.fullname, u.name, u.email)")}  AS tenant_name,
        ${cs(`
          CASE
            WHEN p.status = 'approved' OR i.status='paid' THEN 'approved'
            WHEN p.status = 'pending'  THEN 'pending'
            WHEN p.status = 'rejected' THEN 'rejected'
            ELSE COALESCE(p.status, i.status)
          END
        `)}                                             AS payment_status
      FROM payments p
      JOIN invoices  i ON i.id = p.invoice_id
      LEFT JOIN tenants t ON t.tenant_id = i.tenant_id
      LEFT JOIN users   u ON u.id      = t.user_id
      LEFT JOIN rooms   r ON r.room_id = i.room_id
      WHERE p.status = 'approved'
        AND COALESCE(i.paid_at, p.payment_date) BETWEEN ? AND ?

      UNION ALL

      SELECT
        i.paid_at                                       AS paid_at,
        r.room_id                                       AS room_id,
        ${cs("r.room_number")}                          AS room_number,
        ${cs("i.invoice_no")}                           AS invoice_no,
        i.amount                                        AS amount,
        ${cs("COALESCE(u.fullname, u.name, u.email)")}  AS tenant_name,
        ${cs(`'approved'`)}                             AS payment_status
      FROM invoices i
      LEFT JOIN tenants t ON t.tenant_id = i.tenant_id
      LEFT JOIN users   u ON u.id      = t.user_id
      LEFT JOIN rooms   r ON r.room_id = i.room_id
      WHERE i.status = 'paid'
        AND i.paid_at BETWEEN ? AND ?
        AND NOT EXISTS (SELECT 1 FROM payments p2 WHERE p2.invoice_id = i.id AND p2.status = 'approved')

      ORDER BY
        paid_at DESC,
        CAST(NULLIF(room_number,'') AS UNSIGNED),
        room_number
    `;
    const [rows] = await pool.query(sql, [dtFrom, dtTo, dtFrom, dtTo]);
    res.json(Array.isArray(rows) ? rows : []);
  } catch (err) { next(err); }
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
        COALESCE(i.rent_amount,     0)       AS rent_amount,
        COALESCE(i.water_amount,    0)       AS water_amount,
        COALESCE(i.electric_amount, 0)       AS electric_amount,
        COALESCE(i.amount,          0)       AS total_amount,
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
/* ► รองรับชื่อคอลัมน์หลากหลาย โดยอ่านจาก information_schema ก่อนสร้าง SQL */
exports.getMeterMonthlySimple = async (req, res, next) => {
  try {
    const period_ym = req.query.period_ym || req.query.ym;
    if (!period_ym) return res.status(400).json({ error: "period_ym (YYYY-MM) is required" });

    // ยอมรับเฉพาะรูปแบบ YYYY-MM เท่านั้น เพื่อความปลอดภัยในการฝังค่าเป็น literal
    const ymSafe = /^\d{4}-\d{2}$/.test(String(period_ym)) ? period_ym : null;
    if (!ymSafe) return res.status(400).json({ error: "period_ym must be YYYY-MM" });

    const C = "utf8mb4_unicode_ci";
    const cs = (expr) => `CONVERT(${expr} USING utf8mb4) COLLATE ${C}`;

    const mc = await getMeterCols();

    // --- เงื่อนไข JOIN (ฝังค่า ymSafe แบบ literal หลัง validate แล้ว) ---
    let joinCond = `m.room_id = r.room_id`;
    if (mc.period_ym) {
      joinCond += ` AND m.\`${mc.period_ym}\` = '${ymSafe}'`;
    } else if (mc.reading_date) {
      joinCond += ` AND DATE_FORMAT(m.\`${mc.reading_date}\`,'%Y-%m') = '${ymSafe}'`;
    } else {
      joinCond += ` AND 1=0`; // ไม่มีคอลัมน์บอกงวด → ไม่แมทช์แถว (ยังแสดงรายชื่อห้องได้)
    }

    const selWaterUnits  = mc.water_units
      ? `COALESCE(m.\`${mc.water_units}\`, 0)` : `0`;
    const selElecUnits   = mc.electric_units
      ? `COALESCE(m.\`${mc.electric_units}\`, 0)` : `0`;
    const selWaterRate   = mc.water_rate
      ? `COALESCE(m.\`${mc.water_rate}\`, 7)` : `7`;
    const selElecRate    = mc.electric_rate
      ? `COALESCE(m.\`${mc.electric_rate}\`, 7)` : `7`;
    const selIsLocked    = mc.is_locked
      ? `COALESCE(m.\`${mc.is_locked}\`, 0)` : `0`;

    const sql = `
      SELECT
        r.room_id,
        ${cs("r.room_number")}                      AS room_number,
        ${cs("COALESCE(u.name, u.fullname, '-')")}  AS tenant_name,
        '${ymSafe}'                                  AS period_ym,
        ${selWaterUnits}                             AS water_units,
        ${selElecUnits}                              AS electric_units,
        ${selWaterRate}                              AS water_rate,
        ${selElecRate}                               AS electric_rate,
        ${selIsLocked}                               AS is_locked
      FROM rooms r
      LEFT JOIN tenants t ON t.room_id = r.room_id AND COALESCE(t.is_deleted,0) = 0
      LEFT JOIN users   u ON u.id      = t.user_id
      LEFT JOIN meter_readings m ON ${joinCond}
      ORDER BY
        CAST(NULLIF(${cs("r.room_number")},'') AS UNSIGNED),
        ${cs("r.room_number")}
    `;

    // ไม่มี placeholder แล้ว → ไม่ต้องส่ง params
    const [rows] = await pool.query(sql);
    res.json(asArray(rows));
  } catch (err) { next(err); }
};

/* ► บันทึก (upsert) ตามคอลัมน์ที่มีจริง */
exports.saveMeterSimple = async (req, res, next) => {
  try {
    const {
      room_id, period_ym,
      water_units = 0, electric_units = 0,
      water_rate = 7, electric_rate = 7,
    } = req.body || {};

    if (!room_id || !period_ym) return res.status(400).json({ error: "room_id & period_ym required" });

    const mc = await getMeterCols();

    // วันที่อ่าน = วันสุดท้ายของเดือนที่เลือก
    const readingDate = (() => {
      const d = new Date(`${period_ym}-01T00:00:00`);
      d.setMonth(d.getMonth() + 1); d.setDate(0);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    })();

    // กันล็อก
    if (mc.is_locked && mc.period_ym) {
      const [[cur]] = await pool.query(
        `SELECT \`${mc.is_locked}\` AS locked FROM meter_readings WHERE room_id=? AND \`${mc.period_ym}\`=?`,
        [room_id, period_ym]
      );
      if (cur && Number(cur.locked) === 1) {
        return res.status(400).json({ error: "รายการนี้ถูกล็อกแล้ว" });
      }
    }

    // สร้างคำสั่ง INSERT/UPDATE ตามคอลัมน์ที่มีจริง
    const cols = ["room_id"];
    const vals = ["?"];
    const args = [room_id];

    if (mc.period_ym) { cols.push(`\`${mc.period_ym}\``); vals.push("?"); args.push(period_ym); }
    if (mc.reading_date) { cols.push(`\`${mc.reading_date}\``); vals.push("?"); args.push(readingDate); }
    if (mc.water_units) { cols.push(`\`${mc.water_units}\``); vals.push("?"); args.push(Number(water_units) || 0); }
    if (mc.electric_units) { cols.push(`\`${mc.electric_units}\``); vals.push("?"); args.push(Number(electric_units) || 0); }
    if (mc.water_rate) { cols.push(`\`${mc.water_rate}\``); vals.push("?"); args.push(Number(water_rate) || 0); }
    if (mc.electric_rate) { cols.push(`\`${mc.electric_rate}\``); vals.push("?"); args.push(Number(electric_rate) || 0); }
    if (mc.is_locked) { cols.push(`\`${mc.is_locked}\``); vals.push("0"); } // default 0

    const updateSets = cols
      .filter((c) => c !== "room_id")
      .map((c) => `${c}=VALUES(${c})`)
      .join(", ");

    // ถ้าไม่มี period/read_date เลย จะใช้ room_id เป็น key -> อาจซ้ำหลายเดือนไม่ได้
    const sql = `
      INSERT INTO meter_readings (${cols.join(", ")})
      VALUES (${vals.join(", ")})
      ON DUPLICATE KEY UPDATE ${updateSets}
    `;
    await pool.query(sql, args);

    // read back
    const where =
      mc.period_ym ? `room_id=? AND \`${mc.period_ym}\`=?`
      : mc.reading_date ? `room_id=? AND DATE_FORMAT(\`${mc.reading_date}\`,'%Y-%m')=?`
      : `room_id=?`;

    const [rows] = await pool.query(
      `SELECT * FROM meter_readings WHERE ${where} ORDER BY 1 DESC LIMIT 1`,
      mc.period_ym ? [room_id, period_ym] : mc.reading_date ? [room_id, period_ym] : [room_id]
    );

    res.json(rows?.[0] || { ok: true });
  } catch (err) { next(err); }
};

/* ► ล็อก/ปลดล็อก ตามคอลัมน์ที่มีจริง */
exports.toggleMeterLock = async (req, res, next) => {
  try {
    const { room_id, period_ym, lock } = req.body || {};
    if (!room_id || !period_ym) return res.status(400).json({ error: "room_id & period_ym required" });

    const mc = await getMeterCols();
    if (!mc.is_locked) return res.status(400).json({ error: "ตารางนี้ไม่มีคอลัมน์สถานะล็อก" });

    const cols = ["room_id", `\`${mc.is_locked}\``];
    const vals = ["?", "?"];
    const args = [room_id, lock ? 1 : 0];
    if (mc.period_ym) { cols.push(`\`${mc.period_ym}\``); vals.push("?"); args.push(period_ym); }
    if (mc.reading_date) { cols.push(`\`${mc.reading_date}\``); vals.push("?"); args.push(`${period_ym}-28`); }

    const updateSets = cols
      .filter((c) => c !== "room_id")
      .map((c) => `${c}=VALUES(${c})`)
      .join(", ");

    const sql = `
      INSERT INTO meter_readings (${cols.join(", ")})
      VALUES (${vals.join(", ")})
      ON DUPLICATE KEY UPDATE ${updateSets}
    `;
    await pool.query(sql, args);

    res.json({ ok: true, is_locked: !!lock });
  } catch (err) { next(err); }
};

/* ========================= 6) Monthly summary ========================= */
exports.monthlySummary = async (req, res, next) => {
  try {
    const months = Math.max(1, Math.min(24, Number(req.query.months || 6)));

    const sql = `
      SELECT
        i.period_ym,
        SUM(COALESCE(i.rent_amount,    0)) AS rent_amount,
        SUM(COALESCE(i.water_amount,   0)) AS water_amount,
        SUM(COALESCE(i.electric_amount,0)) AS electric_amount,
        SUM(COALESCE(i.amount,         0)) AS total_amount,
        COUNT(DISTINCT i.room_id)          AS rooms_count,
        0                                   AS rent_collected,
        0                                   AS water_collected,
        0                                   AS electric_collected,
        SUM(COALESCE(paid.paid_amount, 0))  AS total_collected
      FROM invoices i
      LEFT JOIN (
        SELECT invoice_id, SUM(amount) AS paid_amount
        FROM payments
        WHERE status = 'approved'
        GROUP BY invoice_id
      ) AS paid
        ON paid.invoice_id = i.id
      WHERE i.period_ym >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL ? MONTH), '%Y-%m')
      GROUP BY i.period_ym
      ORDER BY i.period_ym DESC
      LIMIT ?
    `;
    const [rows] = await pool.query(sql, [Number(months), Number(months)]);
    return res.json(asArray(rows));
  } catch (err) { next(err); }
};

/* ========================= 7) Monthly breakdown ========================= */
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

exports.getRoomsStatus = async (_req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        r.room_id,
        r.room_number,
        r.room_number AS roomNo,  -- alias เดิมให้อยู่ได้
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
      LEFT JOIN tenants t ON t.room_id = r.room_id AND COALESCE(t.is_deleted,0) = 0
      LEFT JOIN users   u ON u.id = t.user_id
      ORDER BY r.room_number+0, r.room_number
    `);
    res.json(Array.isArray(rows) ? rows : []);
  } catch (err) { next(err); }
};