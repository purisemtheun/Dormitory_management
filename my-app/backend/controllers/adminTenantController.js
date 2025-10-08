// backend/controllers/adminTenantController.js
// (วางทับไฟล์เดิม)
const db = require('../config/db');
const bcrypt = require('bcryptjs');

// helper: create tenant id T0001...
async function makeTenantId(conn) {
  const qConn = conn || db;
  const [[row]] = await qConn.query(
    "SELECT MAX(CAST(REPLACE(tenant_id,'T','') AS UNSIGNED)) AS maxn FROM tenants"
  );
  const next = (row?.maxn || 0) + 1;
  return 'T' + String(next).padStart(4, '0');
}

const codeExpr =
  "CONCAT('T', LPAD(CAST(REPLACE(t.tenant_id,'T','') AS UNSIGNED), 4, '0'))";

/**
 * GET /api/admin/tenants?q=...
 */
async function listTenants(req, res, next) {
  try {
    const q = (req.query.q || '').trim();

    const sql =
      "SELECT " +
      `  ${codeExpr} AS tenant_code, ` +
      "  t.tenant_id, t.user_id, u.name, u.phone, t.room_id, t.checkin_date " +
      "FROM tenants t " +
      "JOIN users u ON u.id = t.user_id " +
      "JOIN ( " +
      "  SELECT x.user_id, " +
      "         MAX(CONCAT( " +
      "           CASE WHEN x.room_id IS NOT NULL AND x.room_id <> '' THEN '1' ELSE '0' END, '|', " +
      "           COALESCE(DATE_FORMAT(x.checkin_date, '%Y%m%d'), '00000000'), '|', " +
      "           LPAD(CAST(REPLACE(x.tenant_id,'T','') AS UNSIGNED), 10, '0') " +
      "         )) AS selkey " +
      "  FROM tenants x " +
      "  WHERE x.is_deleted = 0 " +
      "  GROUP BY x.user_id " +
      ") pick ON pick.user_id = t.user_id " +
      "       AND CONCAT( " +
      "             CASE WHEN t.room_id IS NOT NULL AND t.room_id <> '' THEN '1' ELSE '0' END, '|', " +
      "             COALESCE(DATE_FORMAT(t.checkin_date, '%Y%m%d'), '00000000'), '|', " +
      "             LPAD(CAST(REPLACE(t.tenant_id,'T','') AS UNSIGNED), 10, '0') " +
      "           ) = pick.selkey " +
      "WHERE t.is_deleted = 0 " +
      ( /^T\d{4}$/i.test(q)
          ? "AND CONCAT('T', LPAD(CAST(REPLACE(t.tenant_id,'T','') AS UNSIGNED), 4, '0')) = ? "
          : (q ? "AND u.name LIKE ? " : "")
      ) +
      "ORDER BY t.tenant_id DESC";

    const params = [];
    if (/^T\d{4}$/i.test(q)) params.push(q.toUpperCase());
    else if (q) params.push(`%${q}%`);

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (e) {
    console.error('listTenants error:', e);
    next(e);
  }
}

/**
 * POST /api/admin/tenants
 * body: { name (required), phone?, checkin_date? }
 */
// replace only the createTenant function in backend/controllers/adminTenantController.js
// (or replace the whole file with the earlier full controller that included transactions)
async function createTenant(req, res, next) {
  let connection;
  try {
    let { name, phone, checkin_date, room_id } = req.body || {};
    name = (name || '').trim();

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    // Normalize room_id:
    // - if client didn't send room_id => set to empty string ''
    // - if sent empty string => keep '' (means "ยังไม่ผูกห้อง")
    // - if sent a value => keep that (we will validate below)
    const wantRoom = typeof room_id !== 'undefined';
    const roomIdNormalized = wantRoom ? (room_id === '' ? '' : String(room_id).trim()) : '';

    // get connection for transaction if possible
    if (typeof db.getConnection === 'function') {
      connection = await db.getConnection();
    }
    const q = connection || db;

    if (connection && typeof connection.beginTransaction === 'function') {
      await connection.beginTransaction();
    }

    // If a non-empty room_id was provided, ensure the room exists
    if (roomIdNormalized) {
      const [[r]] = await q.query('SELECT room_id FROM rooms WHERE room_id = ?', [roomIdNormalized]);
      if (!r) {
        // rollback and respond
        if (connection && typeof connection.rollback === 'function') await connection.rollback();
        return res.status(400).json({ error: 'Invalid room_id: room does not exist', code: 'ROOM_NOT_FOUND' });
      }
    }

    // create user
    const tempPassword = Math.random().toString(36).slice(2, 10);
    const hashed = await bcrypt.hash(tempPassword, 10);

    let userId;
    try {
      const [uIns] = await q.query(
        'INSERT INTO users (name, email, password, role, phone) VALUES (?, NULL, ?, "tenant", ?)',
        [name, hashed, phone || null]
      );
      userId = uIns.insertId;
    } catch (eInsertUser) {
      // fallback if email=NULL not allowed — create a fallback email
      const fallbackEmail = `tenant+${Date.now()}_${Math.floor(Math.random()*10000)}@example.invalid`;
      const [uIns2] = await q.query(
        'INSERT INTO users (name, email, password, role, phone) VALUES (?, ?, ?, "tenant", ?)',
        [name, fallbackEmail, hashed, phone || null]
      );
      userId = uIns2.insertId;
    }

    // make tenant_id (using same connection)
    const tenantId = await makeTenantId(q);

    // Insert tenant — IMPORTANT: supply non-null value for room_id
    // If the DB schema disallows NULL, we pass '' (empty string) when no room provided.
    await q.query(
      'INSERT INTO tenants (tenant_id, user_id, room_id, checkin_date, is_deleted) VALUES (?,?,?,?,0)',
      [tenantId, userId, roomIdNormalized || '', checkin_date || null]
    );

    if (connection && typeof connection.commit === 'function') {
      await connection.commit();
    }

    // return created row
    const [[row]] = await db.query(`
      SELECT ${codeExpr} AS tenant_code, t.tenant_id, t.user_id, u.name, u.phone, t.room_id, t.checkin_date
      FROM tenants t JOIN users u ON u.id = t.user_id
      WHERE t.tenant_id = ?
    `, [tenantId]);

    return res.status(201).json(row);
  } catch (e) {
    console.error('createTenant error:', e);
    try {
      if (connection && typeof connection.rollback === 'function') await connection.rollback();
    } catch (rbErr) {
      console.error('rollback error:', rbErr);
    }
    return res.status(500).json({ error: e.message || 'Internal server error' });
  } finally {
    if (connection && typeof connection.release === 'function') {
      connection.release();
    }
  }
}


/**
 * PATCH /api/admin/tenants/:id
 */
async function updateTenant(req, res, next) {
  try {
    const id = req.params.id; // tenant_id
    let { name, phone, room_id, checkin_date } = req.body;

    const [[t]] = await db.query(
      'SELECT user_id FROM tenants WHERE tenant_id = ? AND is_deleted = 0',
      [id]
    );
    if (!t) {
      return res.status(404).json({ error: 'Tenant not found', code: 'TENANT_NOT_FOUND' });
    }

    if (name != null || phone != null) {
      await db.query(
        'UPDATE users SET name = COALESCE(?, name), phone = COALESCE(?, phone) WHERE id = ?',
        [name ?? null, phone ?? null, t.user_id]
      );
    }

    const wantUpdateRoom = room_id !== undefined;
    const wantUpdateCheckin = checkin_date !== undefined;

    const roomIdNormalized =
      room_id === undefined ? undefined : (room_id === '' ? null : room_id);

    const checkinNormalized =
      checkin_date === undefined ? undefined :
      (checkin_date === '' ? null : checkin_date);

    if (wantUpdateRoom && roomIdNormalized !== null) {
      const [[r]] = await db.query('SELECT room_id FROM rooms WHERE room_id = ?', [roomIdNormalized]);
      if (!r) {
        return res.status(400).json({
          error: 'Invalid room_id: room does not exist',
          code: 'ROOM_NOT_FOUND'
        });
      }
    }

    if (wantUpdateRoom || wantUpdateCheckin) {
      await db.query(
        'UPDATE tenants SET ' +
          (wantUpdateRoom ? 'room_id = ?, ' : '') +
          (wantUpdateCheckin ? 'checkin_date = ?, ' : '') +
          'tenant_id = tenant_id ' +
          'WHERE tenant_id = ? AND is_deleted = 0',
        [
          ...(wantUpdateRoom ? [roomIdNormalized] : []),
          ...(wantUpdateCheckin ? [checkinNormalized] : []),
          id
        ]
      );
    }

    res.json({ message: 'updated' });
  } catch (e) {
    console.error('updateTenant error:', e);
    next(e);
  }
}

/**
 * DELETE /api/admin/tenants/:id  (soft delete)
 */
async function deleteTenant(req, res) {
  try {
    const { id } = req.params;

    const [ret] = await db.query(
      'UPDATE tenants SET is_deleted = 1 WHERE tenant_id = ? AND is_deleted = 0',
      [id]
    );

    if (ret.affectedRows === 0) {
      return res.status(404).json({
        error: 'Tenant not found or already deleted',
        code: 'TENANT_NOT_FOUND',
      });
    }

    res.json({ message: 'ลบผู้เช่าสำเร็จ (soft delete)' });
  } catch (err) {
    console.error('deleteTenant error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  listTenants,
  createTenant,
  updateTenant,
  deleteTenant,
};
