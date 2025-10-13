// backend/controllers/debtController.js
const db = require('../config/db');

/* ==================== Schema Resolver (auto-detect once) ==================== */
let SCHEMA_CACHE = null;

async function resolveSchema() {
  if (SCHEMA_CACHE) return SCHEMA_CACHE;

  const [cols] = await db.query(`
    SELECT TABLE_NAME, COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME IN ('tenants','rooms','tenant_debt_summary','invoices','payments','users','contracts')
  `);

  const by   = (t) => cols.filter(r => r.TABLE_NAME === t).map(r => r.COLUMN_NAME.toLowerCase());
  const has  = (list, name) => list.includes(String(name).toLowerCase());
  const pick = (list, cands) => cands.find(c => has(list, c)) || null;

  const TENANTS   = by('tenants').length   ? 'tenants'   : null;
  const ROOMS     = by('rooms').length     ? 'rooms'     : null;
  const SUMMARY   = by('tenant_debt_summary').length ? 'tenant_debt_summary' : null;
  const USERS     = by('users').length     ? 'users'     : null;
  const CONTRACTS = by('contracts').length ? 'contracts' : null;

  const tCols = TENANTS ? by(TENANTS) : [];
  const rCols = ROOMS   ? by(ROOMS)   : [];
  const sCols = SUMMARY ? by(SUMMARY) : [];
  const uCols = USERS   ? by(USERS)   : [];
  const cCols = CONTRACTS ? by(CONTRACTS) : [];

  // tenants (required fields: id)
  const tId     = pick(tCols, ['tenant_id','id']) || 'tenant_id';
  const tUserFk = pick(tCols, ['user_id','uid']) || null;
  const tRoomFk = pick(tCols, ['room_id','roomid','room_fk','room']) || null;

  // name/phone in tenants
  const tName  = pick(tCols, ['tenant_name','name','fullname','full_name','display_name','customer_name','client_name']);
  const tFirst = pick(tCols, ['first_name','firstname','fname']);
  const tLast  = pick(tCols, ['last_name','lastname','lname']);
  const tPhone = pick(tCols, ['phone','tel','telephone','mobile','phone_number','phonenumber']);

  // users (all optional)
  const uId    = USERS ? (pick(uCols, ['user_id','id']) || null) : null;
  const uName  = USERS ? pick(uCols, ['name','full_name','fullname','display_name','username']) : null;
  const uFirst = USERS ? pick(uCols, ['first_name','firstname','fname']) : null;
  const uLast  = USERS ? pick(uCols, ['last_name','lastname','lname']) : null;
  const uPhone = USERS ? pick(uCols, ['phone','tel','telephone','mobile','phone_number','phonenumber']) : null;

  // rooms (required: id / room_no — อย่างน้อยหนึ่ง)
  const rId  = pick(rCols, ['room_id','id']) || 'room_id';
  const rNo  = pick(rCols, ['room_no','room_number','number','no']) || 'room_no';
  const rTid = pick(rCols, ['tenant_id','tid']); // optional

  // contracts (ทั้งหมด optional — **ห้าม**เดาค่า)
  const cTid   = CONTRACTS ? pick(cCols, ['tenant_id','tid']) : null;
  const cRid   = CONTRACTS ? pick(cCols, ['room_id','rid'])   : null;
  const cStat  = CONTRACTS ? pick(cCols, ['status','state'])  : null;
  const cStart = CONTRACTS ? pick(cCols, ['start_date','start','begin_date']) : null;
  const cEnd   = CONTRACTS ? pick(cCols, ['end_date','end','finish_date'])     : null;

  // summary (required table)
  const sTid = pick(sCols, ['tenant_id']) || 'tenant_id';
  const sAmt = pick(sCols, ['outstanding','balance']) || 'outstanding';
  const sDue = pick(sCols, ['last_due','due_date','last_duedate']) || 'last_due';
  const sOvd = pick(sCols, ['overdue_days','overdue','late_days'])  || 'overdue_days';

  // name/phone expression
  let nameExpr, phoneExpr, nameForSearch = [];
  if (tName) {
    nameExpr = `t.${tName}`;
    nameForSearch.push(`t.${tName}`);
  } else if (tFirst && tLast) {
    nameExpr = `CONCAT_WS(' ', t.${tFirst}, t.${tLast})`;
    nameForSearch.push(`t.${tFirst}`, `t.${tLast}`);
  } else if (tFirst || tLast) {
    const single = tFirst || tLast;
    nameExpr = `t.${single}`;
    nameForSearch.push(`t.${single}`);
  } else if (USERS && tUserFk && uId && (uName || uFirst || uLast)) {
    if (uName) { nameExpr = `u.${uName}`; nameForSearch.push(`u.${uName}`); }
    else if (uFirst && uLast) { nameExpr = `CONCAT_WS(' ', u.${uFirst}, u.${uLast})`; nameForSearch.push(`u.${uFirst}`, `u.${uLast}`); }
    else { const single = uFirst || uLast; nameExpr = `u.${single}`; nameForSearch.push(`u.${single}`); }
  } else {
    nameExpr = `CONCAT('Tenant #', t.${tId})`;
  }

  if (tPhone) phoneExpr = `t.${tPhone}`;
  else if (USERS && tUserFk && uId && uPhone) phoneExpr = `u.${uPhone}`;
  else phoneExpr = `NULL`;

  SCHEMA_CACHE = {
    tables: { TENANTS, ROOMS, SUMMARY, USERS, CONTRACTS },
    keys:   { tId, tUserFk, tRoomFk, rId, rNo, rTid, cTid, cRid, cStat, cStart, cEnd, sTid, sAmt, sDue, sOvd, uId },
    expr:   { nameExpr, phoneExpr, nameForSearch },
  };
  return SCHEMA_CACHE;
}

/* ==================== helpers ==================== */
const parseSort = (sortStr) => {
  const allowed = new Set(['outstanding','overdue_days','last_due','tenant_name','room_no']);
  if (!sortStr) return 'overdue_days DESC';
  const [field, raw] = String(sortStr).split(':');
  const dir = (raw || 'asc').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
  return allowed.has(field) ? `${field} ${dir}` : 'overdue_days DESC';
};

/* ==================== Controllers ==================== */
/**
 * GET /api/debts/search
 */
const searchDebts = async (req, res) => {
  try {
    const S = await resolveSchema();
    const {
      query = '',
      room = '',
      status = '',
      minOverdue = 0,
      page = 1,
      limit = 20,
      sort = 'overdue_days:desc',
    } = req.query;

    const _page   = Math.max(1, Number(page) || 1);
    const _limit  = Math.min(100, Math.max(1, Number(limit) || 20));
    const offset  = (_page - 1) * _limit;
    const orderBy = parseSort(sort);

    const wh = [];
    const params = [];
    const joins = [];

    // users (ถ้ามี mapping)
    if (S.tables.USERS && S.keys.tUserFk && S.keys.uId) {
      joins.push(`LEFT JOIN ${S.tables.USERS} u ON u.${S.keys.uId} = t.${S.keys.tUserFk}`);
    }

    // rooms via tenants.room_id → r_fk
    if (S.keys.tRoomFk) {
      joins.push(`LEFT JOIN ${S.tables.ROOMS} r_fk ON r_fk.${S.keys.rId} = t.${S.keys.tRoomFk}`);
    }

    // rooms via latest contract → r_c (ใช้เฉพาะเมื่อมีทั้ง cTid และ cRid จริง ๆ)
    if (!S.keys.tRoomFk && S.tables.CONTRACTS && S.keys.cTid && S.keys.cRid) {
      // สร้างคอลัมน์วันที่ล่าสุดอย่างปลอดภัย (ต้องมีสักตัวในสองตัวนี้ถึงจะใช้ MAX)
      let maxExpr = null;
      if (S.keys.cEnd && S.keys.cStart) maxExpr = `COALESCE(${S.keys.cEnd}, ${S.keys.cStart})`;
      else if (S.keys.cEnd)             maxExpr = `${S.keys.cEnd}`;
      else if (S.keys.cStart)           maxExpr = `${S.keys.cStart}`;
      else                              maxExpr = `${S.keys.cRid}`; // fallback (ไม่ ideal แต่ง่ายสุด)

      joins.push(`
        LEFT JOIN (
          SELECT c.*
          FROM ${S.tables.CONTRACTS} c
          JOIN (
            SELECT ${S.keys.cTid} AS tid, MAX(${maxExpr}) AS mx
            FROM ${S.tables.CONTRACTS}
            GROUP BY ${S.keys.cTid}
          ) pick ON pick.tid = c.${S.keys.cTid}
                 AND ${maxExpr.replaceAll(S.keys.cRid, `c.${S.keys.cRid}`)} = pick.mx
        ) ct ON ct.${S.keys.cTid} = t.${S.keys.tId}
      `);
      joins.push(`LEFT JOIN ${S.tables.ROOMS} r_c ON r_c.${S.keys.rId} = ct.${S.keys.cRid}`);
    }

    // rooms via rooms.tenant_id → r_tid (ถ้ามี)
    if (S.keys.rTid) {
      joins.push(`LEFT JOIN ${S.tables.ROOMS} r_tid ON r_tid.${S.keys.rTid} = t.${S.keys.tId}`);
    }

    // summary
    joins.push(`LEFT JOIN ${S.tables.SUMMARY} s ON s.${S.keys.sTid} = t.${S.keys.tId}`);

    // WHERE
    if (query) {
      const parts = [];
      if (S.expr.nameForSearch.length) {
        parts.push(`(${S.expr.nameForSearch.map(x => `${x} LIKE ?`).join(' OR ')})`);
        S.expr.nameForSearch.forEach(() => params.push(`%${query}%`));
      }
      if (S.expr.phoneExpr !== 'NULL') {
        parts.push(`(${S.expr.phoneExpr} LIKE ?)`);
        params.push(`%${query}%`);
      }
      if (parts.length) wh.push(`(${parts.join(' OR ')})`);
    }

    if (room) {
      wh.push(`
        COALESCE(
          ${S.keys.tRoomFk ? `r_fk.${S.keys.rId}, r_fk.${S.keys.rNo},` : ''}
          ${S.tables.CONTRACTS && S.keys.cTid && S.keys.cRid ? `r_c.${S.keys.rId}, r_c.${S.keys.rNo},` : ''}
          ${S.keys.rTid ? `r_tid.${S.keys.rId}, r_tid.${S.keys.rNo},` : ''}
          NULL
        ) LIKE ?
      `);
      params.push(`%${room}%`);
    }

    if (status === 'unpaid') {
      wh.push(`IFNULL(s.${S.keys.sAmt},0) > 0`);
    } else if (status === 'cleared') {
      wh.push(`IFNULL(s.${S.keys.sAmt},0) = 0`);
    } else if (status === 'partial') {
      wh.push(`EXISTS (SELECT 1 FROM invoices ii WHERE ii.tenant_id = t.${S.keys.tId} AND ii.status='partial')`);
    }

    if (minOverdue) {
      wh.push(`IFNULL(s.${S.keys.sOvd},0) >= ?`);
      params.push(Number(minOverdue));
    }

    const whereSql = wh.length ? `WHERE ${wh.join(' AND ')}` : '';

    // COUNT
    const [cntRows] = await db.query(
      `
      SELECT COUNT(*) AS total
      FROM ${S.tables.TENANTS} t
      ${joins.join('\n')}
      ${whereSql}
      `,
      params
    );
    const total = cntRows?.[0]?.total || 0;

    // DATA (เลือกห้องจากหลายทางอย่างปลอดภัย)
    const roomCoalesceParts = [];
    if (S.keys.tRoomFk) roomCoalesceParts.push(`r_fk.${S.keys.rId}`, `r_fk.${S.keys.rNo}`);
    if (S.tables.CONTRACTS && S.keys.cTid && S.keys.cRid) roomCoalesceParts.push(`r_c.${S.keys.rId}`, `r_c.${S.keys.rNo}`);
    if (S.keys.rTid) roomCoalesceParts.push(`r_tid.${S.keys.rId}`, `r_tid.${S.keys.rNo}`);
    const roomExpr = roomCoalesceParts.length
      ? `COALESCE(${roomCoalesceParts.join(', ')}, '-')`
      : `'-'`;

    const [rows] = await db.query(
      `
      SELECT
        t.${S.keys.tId} AS tenant_id,
        ${S.expr.nameExpr} AS tenant_name,
        ${S.expr.phoneExpr} AS phone,
        ${roomExpr} AS room_no,
        IFNULL(s.${S.keys.sAmt},0) AS outstanding,
        s.${S.keys.sDue} AS last_due,
        IFNULL(s.${S.keys.sOvd},0) AS overdue_days
      FROM ${S.tables.TENANTS} t
      ${joins.join('\n')}
      ${whereSql}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
      `,
      params.concat([_limit, offset])
    );

    res.json({
      success: true,
      page: _page,
      limit: _limit,
      total,
      data: rows,
    });
  } catch (err) {
    console.error('❌ searchDebts error:', err && (err.stack || err.message || err));
    res.status(500).json({ success: false, message: err?.message || 'Server error' });
  }
};

/**
 * GET /api/debts/tenant/:tenantId
 */
const getTenantDebtDetail = async (req, res, next) => {
  try {
    const tenantId = req.params.tenantId;

    const [summaryRows] = await db.query(
      `SELECT tenant_id, outstanding, last_due, overdue_days
       FROM tenant_debt_summary WHERE tenant_id = ?`,
      [tenantId]
    );

    const [invoiceRows] = await db.query(
      `SELECT i.invoice_id, i.issue_date, i.due_date, i.amount, i.status,
              IFNULL(p.paid,0) AS paid
       FROM invoices i
       LEFT JOIN (
         SELECT invoice_id, SUM(amount) AS paid
         FROM payments GROUP BY invoice_id
       ) p ON p.invoice_id = i.invoice_id
       WHERE i.tenant_id = ?
       ORDER BY i.due_date DESC`,
      [tenantId]
    );

    res.json({
      success: true,
      data: {
        summary: (summaryRows && summaryRows[0]) ? summaryRows[0] : null,
        invoices: invoiceRows || []
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/debts/summary
 */
const getDebtSummaryDashboard = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT
         COUNT(*)                                                    AS tenants_total,
         SUM(CASE WHEN IFNULL(outstanding,0) > 0 THEN 1 ELSE 0 END) AS tenants_debtors,
         SUM(IFNULL(outstanding,0))                                  AS outstanding_total,
         SUM(CASE WHEN IFNULL(overdue_days,0) > 0 THEN IFNULL(outstanding,0) ELSE 0 END) AS overdue_total,
         MAX(IFNULL(overdue_days,0))                                 AS max_overdue_days
       FROM tenant_debt_summary`
    );
    res.json({ success: true, data: rows?.[0] || {} });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  searchDebts,
  getTenantDebtDetail,
  getDebtSummaryDashboard,
};
