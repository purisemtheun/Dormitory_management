// backend/controllers/debtController.js
const db = require('../config/db');

/** GET /api/debts/summary */
async function getDebtSummary(_req, res) {
  try {
    // สรุปจาก v_invoice_balance โดยนับเฉพาะ remaining ที่ยังค้างจริง
    const [[sum]] = await db.query(`
      SELECT
        COUNT(DISTINCT t.tenant_id) AS tenants_total,
        COUNT(DISTINCT CASE WHEN vb.remaining > 0 THEN vb.tenant_id END) AS tenants_debtors,
        COALESCE(SUM(CASE WHEN vb.remaining > 0 THEN vb.remaining ELSE 0 END), 0) AS outstanding_total,
        COALESCE(SUM(CASE WHEN vb.remaining > 0 AND CURDATE() > vb.due_date THEN vb.remaining ELSE 0 END), 0) AS overdue_total,
        COALESCE(MAX(CASE WHEN vb.remaining > 0 AND CURDATE() > vb.due_date THEN DATEDIFF(CURDATE(), vb.due_date) END), 0) AS max_overdue_days
      FROM tenants t
      LEFT JOIN v_invoice_balance vb
             ON vb.tenant_id = t.tenant_id
      WHERE (t.is_deleted = 0 OR t.is_deleted IS NULL)
    `);

    res.json({ ok: true, data: sum });
  } catch (e) {
    console.error('getDebtSummary error:', e);
    res.status(500).json({ message: e.message || 'Internal error' });
  }
}

async function searchDebts(req, res) {
  try {
    const {
      query = '',
      room = '',
      status = '',
      minOverdue = 0,
      page = 1,
      limit = 20,
      sort = 'overdue_days:desc',
    } = req.query;

    const p = Math.max(1, Number(page) || 1);
    const l = Math.max(1, Math.min(100, Number(limit) || 20));
    const off = (p - 1) * l;

    // ===== Filters =====
    const where = [];
    const params = [];

    // ค้นจากชื่อ (users) หรือเบอร์ (users.phone)
    if (query) {
      where.push(`(COALESCE(NULLIF(u.fullname,''), u.name) LIKE ? OR u.phone LIKE ?)`);
      params.push(`%${query}%`, `%${query}%`);
    }

    // ค้นห้อง (room_id)
    if (room) {
      where.push(`t.room_id LIKE ?`);
      params.push(`%${room}%`);
    }

    // HAVING ตามสถานะระดับผู้เช่า
    let having = '';
    if (status === 'unpaid') {
      having = 'HAVING outstanding > 0';
    } else if (status === 'cleared') {
      having = 'HAVING outstanding = 0';
    }

    // เกินกำหนดขั้นต่ำ
    if (Number(minOverdue) > 0) {
      having += (having ? ' AND ' : 'HAVING ') + 'overdue_days >= ?';
      params.push(Number(minOverdue));
    }

    // ===== Sorting =====
    const sortMap = {
      'overdue_days:desc': 'overdue_days DESC, outstanding DESC',
      'outstanding:desc':  'outstanding DESC, overdue_days DESC',
      'last_due:asc':      'last_due ASC',
      'tenant_name:asc':   'tenant_name ASC',
      'room_no:asc':       'room_no ASC',
    };
    const orderBy = sortMap[sort] || sortMap['overdue_days:desc'];

    const w = where.length ? `AND ${where.join(' AND ')}` : '';

    // ===== Base (สรุปต่อ tenant โดยอิงยอดคงเหลือจริงจาก v_invoice_balance) =====
    const sqlBase = `
      FROM tenants t
      LEFT JOIN users u  ON u.id = t.user_id
      LEFT JOIN rooms r  ON r.room_id = t.room_id
      LEFT JOIN v_invoice_balance vb
             ON vb.tenant_id = t.tenant_id
            AND vb.remaining > 0
      WHERE (t.is_deleted = 0 OR t.is_deleted IS NULL)
        ${w}
      GROUP BY t.tenant_id, u.fullname, u.name, u.phone, t.room_id, r.room_id
    `;

    // ===== Count =====
    const [cntRows] = await db.query(
      `
      SELECT COUNT(*) AS total
      FROM (
        SELECT
          t.tenant_id,
          COALESCE(NULLIF(u.fullname,''), NULLIF(u.name,''), CONCAT('Tenant#', t.tenant_id)) AS tenant_name,
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
      ) x
      `,
      params
    );
    const total = Number(cntRows?.[0]?.total || 0);

    // ===== Page data =====
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

    res.json({ ok: true, page: p, limit: l, total, data: rows });
  } catch (e) {
    console.error('searchDebts error:', e);
    res.status(500).json({ message: e.message || 'Internal error' });
  }
}


module.exports = {
  getDebtSummary,
  searchDebts,
};
