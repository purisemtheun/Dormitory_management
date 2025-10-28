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

/* ------------------------------ List tenants ----------------------------- */
/** GET /api/admin/tenants?q=...  (ค้นหาได้: T0001 / user_id / name / phone) */
// ใช้ users เป็นฐาน แล้ว LEFT JOIN กับ tenant ล่าสุดต่อ user
async function listTenants(req, res, next) {
  try {
    const q = (req.query.q || '').trim();
    const isTenantCode = /^T\d{4}$/i.test(q);
    const isNumericUserId = /^\d+$/.test(q);

    // ใช้ pickKeyOf เหมือนเดิม (ด้านบนประกาศไว้แล้ว)
    const pkT = pickKeyOf('t1');
    const pkX = pickKeyOf('x');

    const sql =
      "SELECT " +
      "  u.id AS user_id, u.name, u.phone, " +
      "  t1.tenant_id, t1.room_id, t1.checkin_date " +
      "FROM users u " +
      "LEFT JOIN ( " +
      "  SELECT t1.* " +
      "  FROM tenants t1 " +
      "  JOIN ( " +
      "    SELECT x.user_id, MAX(" + pkX + ") AS selkey " +
      "    FROM tenants x WHERE x.is_deleted=0 GROUP BY x.user_id " +
      "  ) pick ON pick.user_id = t1.user_id " +
      "       AND " + pkT + " = pick.selkey " +
      "  WHERE t1.is_deleted=0 " +
      ") t1 ON t1.user_id = u.id " +
      "WHERE u.role = 'tenant' " +
      (q
        ? (isTenantCode
            ? "AND t1.tenant_id = ? "
            : (isNumericUserId
                ? "AND u.id = ? "
                : "AND (u.name LIKE ? OR u.phone LIKE ?) "))
        : "") +
      // เรียงจากเก่าไปใหม่เสมอ:
      // 1) มี tenant มาก่อน, ไม่มี tenant ไว้ล่างสุด
      // 2) ในกลุ่มที่มี tenant: วันที่เช็คอินเก่ากว่าอยู่บน (ASC)
      // 3) ในกลุ่มที่ยังไม่มี tenant: เรียงตาม u.id จากเก่าไปใหม่ (ASC)
      "ORDER BY (t1.tenant_id IS NOT NULL) DESC, " +
      "         COALESCE(t1.checkin_date,'9999-12-31') ASC, " +
      "         u.id ASC";

    const params = [];
    if (q) {
      if (isTenantCode) {
        params.push(q.toUpperCase());
      } else if (isNumericUserId) {
        params.push(Number(q));
      } else {
        params.push(`%${q}%`);
        params.push(`%${q}%`);
      }
    }

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (e) {
    next(e);
  }
}

/* ------------------------------ Create tenant ---------------------------- */
/** POST /api/admin/tenants  body: { name (required), phone?, checkin_date?, room_id? } */
async function createTenant(req, res) {
  let conn;
  try {
    let { name, phone, checkin_date, room_id } = req.body || {};
    name = (name || '').trim();
    if (!name) return res.status(400).json({ error: 'name is required' });

    // room_id: undefined/'' = ยังไม่ผูกห้อง (จะพยายามใส่ NULL; ถ้า schema ไม่ให้ ก็ fallback เป็น '')
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

    // ถ้า schema เดิมบังคับ NOT NULL ให้ใช้ '' แทน NULL
    const roomValue = roomId ?? null;
    await q.query(
      'INSERT INTO tenants (tenant_id, user_id, room_id, checkin_date, is_deleted) VALUES (?,?,?,?,0)',
      [tenantId, userId, roomValue, checkin_date || null]
    );

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
    const [[t]] = await db.query(
      'SELECT user_id FROM tenants WHERE tenant_id = ? AND is_deleted = 0',
      [id]
    );
    if (!t) return res.status(404).json({ error: 'Tenant not found', code: 'TENANT_NOT_FOUND' });

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
    }

    res.json({ message: 'updated' });
  } catch (e) {
    console.error('updateTenant error:', e);
    next(e);
  }
}

/* ------------------------------ Delete tenant ---------------------------- */
/** DELETE /api/admin/tenants/:id  (soft delete) */
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

    // --- 2) ตรวจการอ้างอิงในตารางอื่น (เพิ่ม/ลดตามที่ระบบคุณใช้จริง)
     let refCount = 0;
    if (tenantIds.length) {
      // invoices: มี tenant_id อยู่แล้ว
      const [inv] = await q.query(
        'SELECT COUNT(*) AS c FROM invoices WHERE tenant_id IN (?)',
        [tenantIds]
      );
      // payments: ไม่มี tenant_id → ต้อง join ผ่าน invoices
      const [pay] = await q.query(
        `SELECT COUNT(*) AS c
           FROM payments p
           JOIN invoices i ON i.id = p.invoice_id
          WHERE i.tenant_id IN (?)`,
        [tenantIds]
      );
      // repairs: มี tenant_id
      const [rep] = await q.query(
        'SELECT COUNT(*) AS c FROM repairs WHERE tenant_id IN (?)',
        [tenantIds]
      );
      refCount = (inv[0]?.c || 0) + (pay[0]?.c || 0) + (rep[0]?.c || 0);
    }

    if (refCount > 0) {
      // มีข้อมูลสำคัญอ้างอิงอยู่ — เพื่อความปลอดภัยจะไม่ลบให้
      if (conn?.rollback) await conn.rollback();
      return res.status(400).json({
        error: 'ไม่สามารถลบได้: ผู้ใช้นี้ยังมีข้อมูลที่อ้างอิงอยู่ (บิล/ชำระเงิน/งานซ่อม ฯลฯ)',
        code: 'HAS_REFERENCES'
      });

      // ถ้าต้องการ “บังคับลบทุกอย่าง” จริง ๆ ให้ลบคอมเมนต์ด้านล่างแล้วใช้แทน (ระวังนะครับ)
      // await q.query('DELETE FROM invoices WHERE tenant_id IN (?)', [tenantIds]);
      // await q.query('DELETE FROM payments WHERE tenant_id IN (?)', [tenantIds]);
      // await q.query('DELETE FROM repairs  WHERE tenant_id IN (?)', [tenantIds]);
    }

    // --- 3) ปลดสถานะห้องที่เคยถูกผูกกับ user นี้ (ถ้ามี)
    if (roomIds.length) {
      await q.query('UPDATE rooms SET status = "available" WHERE room_id IN (?)', [roomIds]);
    }

    // --- 4) ลบ tenants ทั้งหมดของ user นี้ + ลบ user ออกจากระบบ
    await q.query('DELETE FROM tenants WHERE user_id = ?', [userId]);
    const [delUser] = await q.query('DELETE FROM users WHERE id = ? AND role = "tenant"', [userId]);

    if (delUser.affectedRows === 0) {
      if (conn?.rollback) await conn.rollback();
      return res.status(404).json({ error: 'User not found', code: 'USER_NOT_FOUND' });
    }

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

/* ----------------------- (Optional) Check-in by userId ------------------- */
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

    await db.query('UPDATE rooms SET status = ? WHERE room_id = ?', ['occupied', roomId]);
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
