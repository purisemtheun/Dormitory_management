// backend/controllers/adminTenantController.js
const db = require('../config/db');
const bcrypt = require('bcryptjs');

/* -------------------------------- Helpers ------------------------------- */
// สร้าง tenant_id รูปแบบ T0001, T0002 ...
async function makeTenantId(conn) {
  const q = conn || db;
  const [[row]] = await q.query(
    "SELECT MAX(CAST(REPLACE(tenant_id,'T','') AS UNSIGNED)) AS maxn FROM tenants"
  );
  const next = (row?.maxn || 0) + 1;
  return 'T' + String(next).padStart(4, '0');
}

// expression สำหรับเลือกเรคอร์ด “ที่ใช้งานล่าสุด/มีห้องอยู่” ต่อผู้ใช้ 1 รายการ (กำหนด alias ได้)
const pickKeyOf = (a) =>
  "CONCAT(" +
  ` CASE WHEN ${a}.room_id IS NOT NULL AND ${a}.room_id<>'' THEN '1' ELSE '0' END, '|',` +
  ` COALESCE(DATE_FORMAT(${a}.checkin_date,'%Y%m%d'),'00000000'),'|',` +
  ` LPAD(CAST(REPLACE(${a}.tenant_id,'T','') AS UNSIGNED),10,'0')` +
  ")";

/** อัปเดตสถานะห้องให้ตรงกับ tenants (occupied/available) */
async function recomputeRoomsStatus(q, roomIds = []) {
  const ids = [...new Set(roomIds.filter(Boolean))];
  if (!ids.length) return;
  await (q || db).query(`
    UPDATE rooms r
    SET r.status = CASE
      WHEN EXISTS (
        SELECT 1 FROM tenants t
        WHERE t.room_id = r.room_id
          AND t.is_deleted = 0
      ) THEN 'occupied'
      ELSE 'available'
    END
    WHERE r.room_id IN (?);
  `, [ids]);
}

/* ------------------------------ List tenants ----------------------------- */
/** GET /api/admin/tenants?q=...  (ค้นหาได้: T0001 / user_id / name / phone) */
async function listTenants(req, res, next) {
  try {
    const q = (req.query.q || "").trim();
    const like = `%${q}%`;

    // หมายเหตุ: ถ้าคอลัมน์ชื่อจริงเป็น fullname ให้แก้ u.name -> u.fullname
    const sqlBase = `
      SELECT
        u.id        AS user_id,
        u.name      AS name,
        u.phone     AS phone,
        t.tenant_id AS tenant_id,
        t.room_id   AS room_id,
        t.checkin_date
      FROM users u
      LEFT JOIN tenants t
        ON t.user_id = u.id
       AND t.is_deleted = 0
      WHERE u.role = 'tenant'
    `;

    let sql = sqlBase;
    const params = [];

    if (q) {
      // ค้นหาง่าย ๆ ตามที่หน้าใช้: ชื่อ/เบอร์/room_id/user_id/tenant_id
      sql += ` AND (
        u.name LIKE ? OR
        u.phone LIKE ? OR
        t.room_id LIKE ? OR
        CAST(u.id AS CHAR) LIKE ? OR
        t.tenant_id LIKE ?
      )`;
      params.push(like, like, like, like, like);
    }

    sql += ` ORDER BY u.id ASC`;

    const [rows] = await db.query(sql, params);
    res.json(rows);          // คืน array ธรรมดา
  } catch (e) {
    next(e);
  }
}
module.exports.listTenants = listTenants;

/* ------------------------------ Create tenant ---------------------------- */
/** POST /api/admin/tenants  body: { name (required), phone?, checkin_date?, room_id? } */
async function createTenant(req, res) {
  let conn;
  try {
    let { name, phone, checkin_date, room_id } = req.body || {};
    name = (name || '').trim();
    if (!name) return res.status(400).json({ error: 'name is required' });

    // room_id: undefined/'' = ยังไม่ผูกห้อง
    let roomId = null;
    if (room_id !== undefined && room_id !== '') roomId = String(room_id).trim();

    conn = (typeof db.getConnection === 'function') ? await db.getConnection() : null;
    const q = conn || db;
    if (conn?.beginTransaction) await conn.beginTransaction();

    if (roomId) {
      const [[r]] = await q.query('SELECT room_id FROM rooms WHERE room_id=?', [roomId]);
      if (!r) {
        if (conn?.rollback) await conn.rollback();
        return res.status(400).json({ error: 'Invalid room_id: room does not exist', code: 'ROOM_NOT_FOUND' });
      }
    }

    const tempPass = Math.random().toString(36).slice(2, 10);
    const hashed = await bcrypt.hash(tempPass, 10);

    let userId;
    try {
      const [r1] = await q.query(
        'INSERT INTO users (name, email, password, role, phone) VALUES (?, NULL, ?, "tenant", ?)',
        [name, hashed, phone || null]
      );
      userId = r1.insertId;
    } catch {
      const fbEmail = `tenant+${Date.now()}_${Math.floor(Math.random()*10000)}@example.invalid`;
      const [r2] = await q.query(
        'INSERT INTO users (name, email, password, role, phone) VALUES (?, ?, ?, "tenant", ?)',
        [name, fbEmail, hashed, phone || null]
      );
      userId = r2.insertId;
    }

    const tenantId = await makeTenantId(q);
    await q.query(
      'INSERT INTO tenants (tenant_id, user_id, room_id, checkin_date, is_deleted) VALUES (?,?,?,?,0)',
      [tenantId, userId, roomId ?? null, checkin_date || null]
    );

    // รีเฟรชสถานะห้องถ้ามีการผูกห้องตั้งแต่ต้น
    if (roomId) await recomputeRoomsStatus(q, [roomId]);

    if (conn?.commit) await conn.commit();

    const [[row]] = await db.query(
      'SELECT t.user_id,u.name,u.phone,t.room_id,t.checkin_date,t.tenant_id ' +
      'FROM tenants t JOIN users u ON u.id=t.user_id WHERE t.tenant_id=?',
      [tenantId]
    );
    res.status(201).json(row);
  } catch (e) {
    if (conn?.rollback) await conn.rollback();
    res.status(500).json({ error: e.message || 'Internal server error' });
  } finally {
    conn?.release?.();
  }
}

/* ------------------------------ Update tenant ---------------------------- */
/** PATCH /api/admin/tenants/:id  (id = tenant_id) body: { name?, phone?, room_id?, checkin_date? } */
async function updateTenant(req, res, next) {
  try {
    const id = req.params.id;
    let { name, phone, room_id, checkin_date } = req.body || {};

    // ดึง room เดิมไว้เพื่อรีเฟรชสถานะภายหลัง
    const [[t0]] = await db.query(
      'SELECT user_id, room_id FROM tenants WHERE tenant_id = ? AND is_deleted = 0',
      [id]
    );
    if (!t0) return res.status(404).json({ error: 'Tenant not found', code: 'TENANT_NOT_FOUND' });
    const prevRoomId = t0.room_id || null;

    if (name != null || phone != null) {
      await db.query(
        'UPDATE users SET name = COALESCE(?, name), phone = COALESCE(?, phone) WHERE id = ?',
        [name ?? null, phone ?? null, t0.user_id]
      );
    }

    const wantUpdateRoom = room_id !== undefined;
    const wantUpdateCheckin = checkin_date !== undefined;

    const roomIdNormalized =
      room_id === undefined ? undefined : (room_id === '' ? null : room_id);
    const checkinNormalized =
      checkin_date === undefined ? undefined : (checkin_date === '' ? null : checkin_date);

    if (wantUpdateRoom && roomIdNormalized !== null && roomIdNormalized !== undefined) {
      const [[r]] = await db.query('SELECT room_id FROM rooms WHERE room_id = ?', [roomIdNormalized]);
      if (!r) {
        return res.status(400).json({ error: 'Invalid room_id: room does not exist', code: 'ROOM_NOT_FOUND' });
      }
    }

    if (wantUpdateRoom || wantUpdateCheckin) {
      const sets = [];
      const params = [];
      if (wantUpdateRoom) { sets.push('room_id = ?'); params.push(roomIdNormalized); }
      if (wantUpdateCheckin) { sets.push('checkin_date = ?'); params.push(checkinNormalized); }
      params.push(id);

      await db.query(
        `UPDATE tenants SET ${sets.join(', ')}, tenant_id = tenant_id WHERE tenant_id = ? AND is_deleted = 0`,
        params
      );

      // รีเฟรชสถานะห้องเก่าและห้องใหม่
      await recomputeRoomsStatus(db, [prevRoomId, roomIdNormalized]);
    }

    res.json({ message: 'updated' });
  } catch (e) {
    console.error('updateTenant error:', e);
    next(e);
  }
}

/* ------------------------------ Delete tenant ---------------------------- */
/** DELETE /api/admin/tenants/:id  (hard delete ผู้ใช้และ tenants ของผู้ใช้นั้น) */
async function deleteTenant(req, res) {
  const tenantId = req.params.id;
  let conn;

  try {
    conn = (typeof db.getConnection === 'function') ? await db.getConnection() : null;
    const q = conn || db;
    if (conn?.beginTransaction) await conn.beginTransaction();

    // --- 1) หา user_id และตรวจว่ามีอยู่จริง/ยังไม่ถูกลบ
    const [[t]] = await q.query(
      'SELECT user_id FROM tenants WHERE tenant_id = ? AND is_deleted = 0',
      [tenantId]
    );
    if (!t) {
      if (conn?.rollback) await conn.rollback();
      return res.status(404).json({ error: 'Tenant not found', code: 'TENANT_NOT_FOUND' });
    }
    const userId = t.user_id;

    // รวม tenant_ids ทั้งหมดของ user นี้ (เราจะเช็คอ้างอิงทีเดียว)
    const [allTs] = await q.query('SELECT tenant_id, room_id FROM tenants WHERE user_id = ?', [userId]);
    const tenantIds = allTs.map(r => r.tenant_id);
    const roomIds = [...new Set(allTs.map(r => r.room_id).filter(Boolean))];

    // --- 2) ตรวจการอ้างอิงในตารางอื่น
    let refCount = 0;
    if (tenantIds.length) {
      const [inv] = await q.query('SELECT COUNT(*) AS c FROM invoices WHERE tenant_id IN (?)', [tenantIds]);
      const [pay] = await q.query(
        `SELECT COUNT(*) AS c
           FROM payments p
           JOIN invoices i ON i.id = p.invoice_id
          WHERE i.tenant_id IN (?)`,
        [tenantIds]
      );
      const [rep] = await q.query('SELECT COUNT(*) AS c FROM repairs WHERE tenant_id IN (?)', [tenantIds]);
      refCount = (inv[0]?.c || 0) + (pay[0]?.c || 0) + (rep[0]?.c || 0);
    }

    if (refCount > 0) {
      if (conn?.rollback) await conn.rollback();
      return res.status(400).json({
        error: 'ไม่สามารถลบได้: ผู้ใช้นี้ยังมีข้อมูลที่อ้างอิงอยู่ (บิล/ชำระเงิน/งานซ่อม ฯลฯ)',
        code: 'HAS_REFERENCES'
      });
    }

    // --- 3) ลบ tenants ทั้งหมดของ user นี้ + ลบ user ออกจากระบบ
    await q.query('DELETE FROM tenants WHERE user_id = ?', [userId]);
    const [delUser] = await q.query('DELETE FROM users WHERE id = ? AND role = "tenant"', [userId]);
    if (delUser.affectedRows === 0) {
      if (conn?.rollback) await conn.rollback();
      return res.status(404).json({ error: 'User not found', code: 'USER_NOT_FOUND' });
    }

    // --- 4) รีเฟรชสถานะห้องที่เกี่ยวข้อง
    if (roomIds.length) await recomputeRoomsStatus(q, roomIds);

    if (conn?.commit) await conn.commit();
    return res.json({ message: 'ลบผู้ใช้และข้อมูลผู้เช่าสำเร็จ (hard delete)' });
  } catch (err) {
    try { if (conn?.rollback) await conn.rollback(); } catch {}
    console.error('deleteTenant error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  } finally {
    conn?.release?.();
  }
}

/* ----------------------- Check-in by userId (book) ----------------------- */
/** POST /api/admin/rooms/:id/book  body: { userId, checkin_date? } */
async function bookRoomForTenant(req, res) {
  try {
    const roomId = req.params.id;
    const { userId, checkin_date } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'ต้องมี userId' });

    const today = new Date().toISOString().slice(0, 10);
    const checkinDate = checkin_date || today;

    const [[room]] = await db.query('SELECT room_id, status FROM rooms WHERE room_id = ?', [roomId]);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (room.status === 'occupied') return res.status(400).json({ error: 'Room already occupied' });

    const [[user]] = await db.query('SELECT id FROM users WHERE id = ?', [userId]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const [roomTenant] = await db.query('SELECT tenant_id FROM tenants WHERE room_id = ? LIMIT 1', [roomId]);
    if (roomTenant.length) return res.status(400).json({ error: 'Room already has a tenant' });

    const [existAssigned] = await db.query(
      'SELECT tenant_id FROM tenants WHERE user_id = ? AND room_id IS NOT NULL AND room_id<>"" LIMIT 1',
      [userId]
    );
    if (existAssigned.length) return res.status(400).json({ error: 'User already checked-in' });

    const [upd] = await db.query(
      `UPDATE tenants
         SET room_id = ?, checkin_date = COALESCE(?, checkin_date)
       WHERE user_id = ?
         AND (room_id IS NULL OR room_id = '')
       LIMIT 1`,
      [roomId, checkinDate, userId]
    );

    let tenantId;
    let mode;
    if (upd.affectedRows > 0) {
      const [[row]] = await db.query(
        'SELECT tenant_id FROM tenants WHERE user_id = ? AND room_id = ? LIMIT 1',
        [userId, roomId]
      );
      tenantId = row?.tenant_id || null;
      mode = 'updated';
    } else {
      const tenantIdNew = await makeTenantId();
      await db.query(
        'INSERT INTO tenants (tenant_id, user_id, room_id, checkin_date) VALUES (?,?,?,?)',
        [tenantIdNew, userId, roomId, checkinDate]
      );
      tenantId = tenantIdNew;
      mode = 'inserted';
    }

    // คำนวณสถานะห้องให้ถูกต้อง
    await recomputeRoomsStatus(db, [roomId]);

    return res.status(201).json({ message: 'Check-in success', tenant_id: tenantId, mode });
  } catch (err) {
    console.error('bookRoomForTenant error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

/* -------------------------------- Exports -------------------------------- */
module.exports = {
  listTenants,
  createTenant,
  updateTenant,
  deleteTenant,
  bookRoomForTenant,
};
