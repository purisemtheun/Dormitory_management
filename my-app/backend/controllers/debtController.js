// backend/controllers/debtController.js
const db = require("../config/db");

/**
 * GET /api/debts
 * สรุปลูกหนี้แบบ "ค้างกี่เดือน" และ "ยอดค้างรวม"
 *
 * query:
 *  - q: คำค้น (ชื่อ/อีเมล/ห้อง/tenant_id)
 *  - min_amount: ขั้นต่ำยอดค้าง (เริ่มต้น 1)
 *  - min_months: ขั้นต่ำจำนวนเดือนที่ค้าง (เริ่มต้น 1)
 *  - overdue_only: 1 = เอาเฉพาะที่เลยกำหนด
 */
exports.search = async (req, res) => {
  try {
    const {
      q = "",
      min_amount = 1,
      min_months = 1,
      overdue_only = 0,
    } = req.query;

    // คิวรีนี้นับ "จำนวนเดือนที่ค้าง" จาก invoices โดยดูสถานะที่ไม่ใช่ paid
    // และรวมยอดค้างจาก amount ของบิลที่ยังไม่ paid
    const sql = `
      SELECT
        t.tenant_id,
        u.fullname AS name,
        u.email,
        IFNULL(u.phone, '') AS phone,
        r.room_number AS room,
        -- ยอดค้างรวมทั้งหมด
        SUM(CASE WHEN i.status = 'paid' THEN 0 ELSE IFNULL(i.amount,0) END) AS outstanding,
        -- จำนวนเดือนที่ค้าง (นับรายการ period_ym ที่ยังไม่ paid)
        COUNT(DISTINCT CASE WHEN i.status <> 'paid' THEN i.period_ym END)   AS months_unpaid,
        -- จำนวนเดือนที่ "เกินกำหนด" แล้ว
        COUNT(DISTINCT CASE WHEN i.status <> 'paid' AND i.due_date < CURDATE() THEN i.period_ym END)
          AS months_overdue,
        -- กำหนดล่าสุดที่ยังค้าง
        MAX(CASE WHEN i.status <> 'paid' THEN i.due_date END) AS last_due
      FROM tenants t
      JOIN users   u ON u.id = t.user_id
      LEFT JOIN rooms   r ON r.room_id = t.room_id
      LEFT JOIN invoices i ON i.tenant_id = t.tenant_id
      GROUP BY t.tenant_id, u.fullname, u.email, u.phone, r.room_number
      HAVING outstanding >= ?
         AND months_unpaid >= ?
         AND (? = 0 OR (months_overdue >= 1))
         AND (? = '' OR LOWER(CONCAT_WS(' ', t.tenant_id, u.fullname, u.email, r.room_number))
                       LIKE CONCAT('%', LOWER(?), '%'))
      ORDER BY outstanding DESC, months_unpaid DESC, u.fullname ASC
    `;

    const params = [
      Number(min_amount),
      Number(min_months),
      Number(overdue_only),
      q, q,
    ];

    const [rows] = await db.query(sql, params);

    const out = rows.map((r) => ({
      tenant_id: r.tenant_id,
      name: r.name,
      email: r.email,
      phone: r.phone,
      room: r.room || "-",
      outstanding: Number(r.outstanding || 0),
      months_unpaid: Number(r.months_unpaid || 0),
      months_overdue: Number(r.months_overdue || 0),
      last_due: r.last_due ? String(r.last_due).slice(0, 10) : null,
    }));

    res.json(out);
  } catch (e) {
    console.error("❌ debts.search error:", e);
    res.status(500).json({ error: "ค้นหาลูกหนี้ไม่สำเร็จ" });
  }
};

/**
 * GET /api/debts/:tenant_id/detail
 * รายการบิลที่ยังค้างแบบละเอียด (แยกตามเดือน)
 */
exports.detailByTenant = async (req, res) => {
  try {
    const { tenant_id } = req.params;

    const [rows] = await db.query(
      `
      SELECT
        i.id          AS invoice_id,
        i.period_ym,
        i.due_date,
        i.amount,
        i.status
      FROM invoices i
      WHERE i.tenant_id = ?
        AND i.status <> 'paid'
      ORDER BY i.period_ym ASC, i.due_date ASC
      `,
      [tenant_id]
    );

    const out = rows.map((r) => ({
      invoice_id: r.invoice_id,
      period_ym: r.period_ym,
      due_date: String(r.due_date).slice(0, 10),
      amount: Number(r.amount || 0),
      status: r.status,
    }));

    res.json(out);
  } catch (e) {
    console.error("❌ debts.detailByTenant error:", e);
    res.status(500).json({ error: "โหลดรายละเอียดหนี้ไม่สำเร็จ" });
  }
};
