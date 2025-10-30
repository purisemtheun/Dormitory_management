// backend/controllers/debtController.js
const db = require('../config/db');

/* ------------------------------------------------------------------ *
 * SUMMARY: ตัวเลขหัวการ์ดหน้า "ค้นหาหนี้ผู้เช่า"
 * พยายามใช้ v_invoice_balance ก่อน; ถ้าไม่มี view จะ fallback ไป invoices
 * โครงสร้างผลลัพธ์เป็น flat object เพื่อให้ frontend อ่านง่าย
 * ------------------------------------------------------------------ */
async function getDebtSummary(_req, res) {
  try {
    // ทางเลือกที่ 1: ใช้ v_invoice_balance (remaining, due_date)
    try {
      const [[row]] = await db.query(`
        SELECT
          /* ผู้เช่า(ไม่ถูกลบ) ทั้งหมด */
          (SELECT COUNT(*) FROM tenants t WHERE COALESCE(t.is_deleted,0)=0) AS tenants_total,
          /* จำนวนผู้เช่าที่มียอดคงเหลือ > 0 */
          COALESCE((
            SELECT COUNT(DISTINCT v.tenant_id)
            FROM v_invoice_balance v
            JOIN tenants t ON t.tenant_id = v.tenant_id AND COALESCE(t.is_deleted,0)=0
            WHERE v.remaining > 0
          ), 0) AS tenants_debtors,
          /* ยอดคงเหลือรวม */
          COALESCE((
            SELECT SUM(v.remaining)
            FROM v_invoice_balance v
            JOIN tenants t ON t.tenant_id = v.tenant_id AND COALESCE(t.is_deleted,0)=0
            WHERE v.remaining > 0
          ), 0) AS outstanding_total,
          /* ยอดคงเหลือที่เลยกำหนดรวม */
          COALESCE((
            SELECT SUM(v.remaining)
            FROM v_invoice_balance v
            JOIN tenants t ON t.tenant_id = v.tenant_id AND COALESCE(t.is_deleted,0)=0
            WHERE v.remaining > 0 AND v.due_date < CURDATE()
          ), 0) AS overdue_total,
          /* วันเกินกำหนดสูงสุด */
          COALESCE((
            SELECT MAX(GREATEST(DATEDIFF(CURDATE(), v.due_date),0))
            FROM v_invoice_balance v
            JOIN tenants t ON t.tenant_id = v.tenant_id AND COALESCE(t.is_deleted,0)=0
            WHERE v.remaining > 0 AND v.due_date < CURDATE()
          ), 0) AS max_overdue_days
      `);
      return res.json(row || { tenants_total:0, tenants_debtors:0, outstanding_total:0, overdue_total:0, max_overdue_days:0 });
    } catch (_) {
      // ถ้า v_invoice_balance ไม่มี/ใช้ไม่ได้ → fallback
    }

    // ทางเลือกที่ 2: fallback จาก invoices (สถานะ UNPAID/OVERDUE)
    const [[row2]] = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM tenants t WHERE COALESCE(t.is_deleted,0)=0) AS tenants_total,
        COALESCE((
          SELECT COUNT(DISTINCT i.tenant_id)
          FROM invoices i
          JOIN tenants t ON t.tenant_id = i.tenant_id AND COALESCE(t.is_deleted,0)=0
          WHERE UPPER(i.status) IN ('UNPAID','OVERDUE')
        ), 0) AS tenants_debtors,
        COALESCE((
          SELECT SUM(i.amount)
          FROM invoices i
          JOIN tenants t ON t.tenant_id = i.tenant_id AND COALESCE(t.is_deleted,0)=0
          WHERE UPPER(i.status) IN ('UNPAID','OVERDUE')
        ), 0) AS outstanding_total,
        COALESCE((
          SELECT SUM(i.amount)
          FROM invoices i
          JOIN tenants t ON t.tenant_id = i.tenant_id AND COALESCE(t.is_deleted,0)=0
          WHERE UPPER(i.status)='OVERDUE'
        ), 0) AS overdue_total,
        COALESCE((
          SELECT MAX(GREATEST(DATEDIFF(CURDATE(), i.due_date),0))
          FROM invoices i
          JOIN tenants t ON t.tenant_id = i.tenant_id AND COALESCE(t.is_deleted,0)=0
          WHERE UPPER(i.status)='OVERDUE'
        ), 0) AS max_overdue_days
    `);

    return res.json(row2 || { tenants_total:0, tenants_debtors:0, outstanding_total:0, overdue_total:0, max_overdue_days:0 });
  } catch (e) {
    console.error('getDebtSummary error:', e);
    res.status(500).json({ message: e.message || 'Internal error' });
  }
}

/* ------------------------------------------------------------------ *
 * SEARCH: ตารางค้นหาหนี้ (รองรับ 0 บาท = แสดง 0 ไม่มั่ว)
 * พยายามใช้ v_invoice_balance; ถ้าไม่มีจะ fallback ไป invoices
 * พารามิเตอร์: ?query=&room=&status=(unpaid|cleared)&minOverdue=&page=&limit=&sort=
 * ------------------------------------------------------------------ */
async function searchDebts(req, res) {
  try {
    const {
      query = '',
      room = '',
      status = '',              // '', 'unpaid', 'cleared'
      minOverdue = 0,
      page = 1,
      limit = 20,
      sort = 'overdue_days:desc',
    } = req.query;

    const p = Math.max(1, Number(page) || 1);
    const l = Math.max(1, Math.min(100, Number(limit) || 20));
    const off = (p - 1) * l;

    // ===== Filters (WHERE/HAVING) =====
    const where = [];
    const params = [];

    if (query) {
      where.push(`(COALESCE(NULLIF(u.fullname,''), u.name) LIKE ? OR u.phone LIKE ?)`);
      params.push(`%${query}%`, `%${query}%`);
    }
    if (room) {
      // front อาจส่ง A101 หรือ 101 ให้รองรับแบบ contains ไว้
      where.push(`(r.room_id LIKE ? OR t.room_id LIKE ?)`);
      params.push(`%${room}%`, `%${room}%`);
    }

    let having = '';
    if (status === 'unpaid') {
      having = 'HAVING outstanding > 0';
    } else if (status === 'cleared') {
      having = 'HAVING outstanding = 0';
    }
    if (Number(minOverdue) > 0) {
      having += (having ? ' AND ' : 'HAVING ') + 'overdue_days >= ?';
      params.push(Number(minOverdue));
    }

    const sortMap = {
      'overdue_days:desc': 'overdue_days DESC, outstanding DESC',
      'outstanding:desc':  'outstanding DESC, overdue_days DESC',
      'last_due:asc':      'last_due ASC',
      'tenant_name:asc':   'tenant_name ASC',
      'room_no:asc':       'room_no ASC',
    };
    const orderBy = sortMap[sort] || sortMap['overdue_days:desc'];
    const w = where.length ? `AND ${where.join(' AND ')}` : '';

    // ---------- Query เวอร์ชันหลัก: v_invoice_balance ----------
    try {
      const sqlBase = `
        FROM tenants t
        LEFT JOIN users u  ON u.id = t.user_id
        LEFT JOIN rooms r  ON r.room_id = t.room_id
        LEFT JOIN v_invoice_balance vb
               ON vb.tenant_id = t.tenant_id
              AND vb.remaining > 0    /* ให้ได้ 0 ได้เพราะเป็น LEFT JOIN */
        WHERE COALESCE(t.is_deleted,0)=0
          ${w}
        GROUP BY t.tenant_id, u.fullname, u.name, u.phone, t.room_id, r.room_id
      `;

      const [cntRows] = await db.query(
        `
        SELECT COUNT(*) AS total
        FROM (
          SELECT
            t.tenant_id,
            COALESCE(SUM(vb.remaining), 0) AS outstanding,
            MAX(CASE WHEN vb.remaining > 0 THEN vb.due_date END) AS last_due,
            CASE
              WHEN COALESCE(SUM(vb.remaining),0) = 0 THEN 0
              WHEN MAX(CASE WHEN vb.remaining > 0 THEN vb.due_date END) IS NULL THEN 0
              WHEN MAX(CASE WHEN vb.remaining > 0 THEN vb.due_date END) < CURDATE()
                THEN DATEDIFF(CURDATE(), MAX(CASE WHEN vb.remaining > 0 THEN vb.due_date END))
              ELSE 0
            END AS overdue_days
          ${sqlBase}
          ${having || ''}
        ) x
        `,
        params
      );
      const total = Number(cntRows?.[0]?.total || 0);

      const [rows] = await db.query(
        `
        SELECT
          t.tenant_id,
          COALESCE(NULLIF(u.fullname,''), NULLIF(u.name,''), CONCAT('Tenant#', t.tenant_id)) AS tenant_name,
          u.phone,
          COALESCE(r.room_id, t.room_id) AS room_no,
          COALESCE(SUM(vb.remaining), 0) AS outstanding,
          MAX(CASE WHEN vb.remaining > 0 THEN vb.due_date END) AS last_due,
          CASE
            WHEN COALESCE(SUM(vb.remaining),0) = 0 THEN 0
            WHEN MAX(CASE WHEN vb.remaining > 0 THEN vb.due_date END) IS NULL THEN 0
            WHEN MAX(CASE WHEN vb.remaining > 0 THEN vb.due_date END) < CURDATE()
              THEN DATEDIFF(CURDATE(), MAX(CASE WHEN vb.remaining > 0 THEN vb.due_date END))
            ELSE 0
          END AS overdue_days
        ${sqlBase}
        ${having || ''}
        ORDER BY ${orderBy}
        LIMIT ? OFFSET ?
        `,
        [...params, l, off]
      );

      return res.json({ ok: true, page: p, limit: l, total, data: rows });
    } catch (_) {
      // ถ้า v_invoice_balance ใช้ไม่ได้ → fallback
    }

    // ---------- Fallback: จาก invoices (UNPAID/OVERDUE) ----------
    const sqlBase2 = `
      FROM tenants t
      LEFT JOIN users u  ON u.id = t.user_id
      LEFT JOIN rooms r  ON r.room_id = t.room_id
      LEFT JOIN invoices i
             ON i.tenant_id = t.tenant_id
            AND UPPER(i.status) IN ('UNPAID','OVERDUE')
      WHERE COALESCE(t.is_deleted,0)=0
        ${w}
      GROUP BY t.tenant_id, u.fullname, u.name, u.phone, t.room_id, r.room_id
    `;

    const [cntRows2] = await db.query(
      `
      SELECT COUNT(*) AS total
      FROM (
        SELECT
          t.tenant_id,
          COALESCE(SUM(i.amount), 0) AS outstanding,
          MAX(i.due_date) AS last_due,
          CASE
            WHEN COALESCE(SUM(i.amount),0) = 0 THEN 0
            WHEN MAX(i.due_date) IS NULL THEN 0
            WHEN MAX(i.due_date) < CURDATE()
              THEN DATEDIFF(CURDATE(), MAX(i.due_date))
            ELSE 0
          END AS overdue_days
      ${sqlBase2}
      ${having || ''}
      ) x
      `,
      params
    );
    const total2 = Number(cntRows2?.[0]?.total || 0);

    const [rows2] = await db.query(
      `
      SELECT
        t.tenant_id,
        COALESCE(NULLIF(u.fullname,''), NULLIF(u.name,''), CONCAT('Tenant#', t.tenant_id)) AS tenant_name,
        u.phone,
        COALESCE(r.room_id, t.room_id) AS room_no,
        COALESCE(SUM(i.amount), 0) AS outstanding,
        MAX(i.due_date) AS last_due,
        CASE
          WHEN COALESCE(SUM(i.amount),0) = 0 THEN 0
          WHEN MAX(i.due_date) IS NULL THEN 0
          WHEN MAX(i.due_date) < CURDATE()
            THEN DATEDIFF(CURDATE(), MAX(i.due_date))
          ELSE 0
        END AS overdue_days
      ${sqlBase2}
      ${having || ''}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
      `,
      [...params, l, off]
    );

    return res.json({ ok: true, page: p, limit: l, total: total2, data: rows2 });
  } catch (e) {
    console.error('searchDebts error:', e);
    res.status(500).json({ message: e.message || 'Internal error' });
  }
}

module.exports = {
  getDebtSummary,
  searchDebts,
};
