// backend/controllers/adminTenantController.js
// =====================================================
// Controller จัดการ "รายชื่อผู้เช่า" (Tenants)
// - ไม่บังคับ email ตอนสร้างผู้เช่า (email = NULL ได้)
// - tenant_id ใช้รูปแบบ 'T0001', 'T0002', ... (สร้างเองในการ INSERT)
// - room_id เริ่มเป็น NULL (ยังไม่ผูกห้อง) และจะไปอัปเดตตอน "book room"
// - รองรับการค้นหาแบบ exact ด้วย tenant_code (T0001) และค้นหาด้วยชื่อ (LIKE)
// - ใช้ Soft Delete ผ่านคอลัมน์ is_deleted (0 = ปกติ, 1 = ถูกลบ)
// =====================================================

const db = require('../config/db');
const bcrypt = require('bcryptjs');

// -----------------------------------------------------
// Helper: สร้างรหัสผู้เช่าใหม่ (tenant_id) รูปแบบ T0001
// ดึงเลขสูงสุดที่มี แล้ว +1 แล้วแปะ 'T' + pad 4 หลัก
// -----------------------------------------------------
async function makeTenantId() {
  const [[row]] = await db.query(
    "SELECT MAX(CAST(REPLACE(tenant_id,'T','') AS UNSIGNED)) AS maxn FROM tenants"
  );
  const next = (row?.maxn || 0) + 1;
  return 'T' + String(next).padStart(4, '0');
}

// -----------------------------------------------------
// Expression: แสดงรหัสสั้นของผู้เช่าเสมอเป็น Txxxx
// (กันเคสที่ tenant_id ในตารางอาจมีตัว 'T' อยู่แล้ว -> ตัดออกก่อนแปลงเลข)
// -----------------------------------------------------
const codeExpr =
  "CONCAT('T', LPAD(CAST(REPLACE(t.tenant_id,'T','') AS UNSIGNED), 4, '0'))";

// -----------------------------------------------------
// GET /api/admin/tenants?q=...
// - แสดงผู้เช่า "ล่าสุดต่อคน" แค่ 1 แถว (ให้ความสำคัญกับแถวที่ room_id ไม่ว่าง > วันที่ใหม่สุด > tenant_id มากสุด)
// - รองรับค้นหาทั้งรหัส T0001 (exact) หรือชื่อ (LIKE)
// - กรองเฉพาะที่ is_deleted = 0
// -----------------------------------------------------
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
      "  WHERE x.is_deleted = 0 " + // ✅ กรองลบออก
      "  GROUP BY x.user_id " +
      ") pick ON pick.user_id = t.user_id " +
      "       AND CONCAT( " +
      "             CASE WHEN t.room_id IS NOT NULL AND t.room_id <> '' THEN '1' ELSE '0' END, '|', " +
      "             COALESCE(DATE_FORMAT(t.checkin_date, '%Y%m%d'), '00000000'), '|', " +
      "             LPAD(CAST(REPLACE(t.tenant_id,'T','') AS UNSIGNED), 10, '0') " +
      "           ) = pick.selkey " +
      "WHERE t.is_deleted = 0 " + // ✅ กรองลบออก
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
    next(e);
  }
}

// -----------------------------------------------------
// POST /api/admin/tenants
// body: { name (required), phone?, checkin_date? }
// - ไม่ต้องมี email (NULL ได้)
// - จะสร้าง users (role='tenant') และแถว tenants โดย room_id = NULL
// -----------------------------------------------------
async function createTenant(req, res, next) {
  try {
    let { name, phone, checkin_date } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'name is required' });
    }

    // สร้างผู้ใช้ (email = NULL, role=tenant, ตั้งรหัสผ่านชั่วคราว)
    const tempPassword = Math.random().toString(36).slice(2, 10);
    const hashed = await bcrypt.hash(tempPassword, 10);

    const [uIns] = await db.query(
      'INSERT INTO users (name, email, password, role, phone) VALUES (?, NULL, ?, "tenant", ?)',
      [name.trim(), hashed, phone || null]
    );
    const userId = uIns.insertId;

    // สร้าง tenant_id ใหม่ แล้ว INSERT แถว tenants โดย room_id = NULL, is_deleted = 0
    const tenantId = await makeTenantId();
    await db.query(
      'INSERT INTO tenants (tenant_id, user_id, room_id, checkin_date, is_deleted) VALUES (?,?,NULL,?,0)',
      [tenantId, userId, checkin_date || null]
    );

    // ตอบกลับแถวที่สร้าง (พร้อม tenant_code)
    const [[row]] = await db.query(`
      SELECT ${codeExpr} AS tenant_code, t.tenant_id, t.user_id, u.name, u.phone, t.room_id, t.checkin_date
      FROM tenants t JOIN users u ON u.id = t.user_id
      WHERE t.tenant_id = ?
    `, [tenantId]);

    res.status(201).json(row);
  } catch (e) {
    next(e);
  }
}

// -----------------------------------------------------
// PATCH /api/admin/tenants/:id
// - id = tenant_id
// - body รองรับอัปเดตบางฟิลด์: name, phone (users), room_id, checkin_date (tenants)
// -----------------------------------------------------
async function updateTenant(req, res, next) {
  try {
    const id = req.params.id; // tenant_id
    let { name, phone, room_id, checkin_date } = req.body;

    // หา user_id ก่อนเพื่ออัปเดตตาราง users และเช็คว่า tenant ยังไม่ถูกลบ
    const [[t]] = await db.query(
      'SELECT user_id FROM tenants WHERE tenant_id = ? AND is_deleted = 0',
      [id]
    );
    if (!t) {
      return res.status(404).json({ error: 'Tenant not found', code: 'TENANT_NOT_FOUND' });
    }

    // 1) อัปเดต users
    if (name != null || phone != null) {
      await db.query(
        'UPDATE users SET name = COALESCE(?, name), phone = COALESCE(?, phone) WHERE id = ?',
        [name ?? null, phone ?? null, t.user_id]
      );
    }

    // 2) เตรียมค่าปกติของ room_id / checkin_date
    // - ถ้า body ไม่ส่ง field มาเลย -> ไม่แตะฟิลด์นั้น
    // - ถ้าส่ง "" (ค่าว่าง) -> ตั้งเป็น NULL เพื่อให้ผ่าน FK
    const wantUpdateRoom = room_id !== undefined;
    const wantUpdateCheckin = checkin_date !== undefined;

    const roomIdNormalized =
      room_id === undefined ? undefined : (room_id === '' ? null : room_id);

    const checkinNormalized =
      checkin_date === undefined ? undefined :
      (checkin_date === '' ? null : checkin_date);

    // 3) ถ้า room_id ตั้งค่ามา (ไม่ใช่ undefined) และไม่ใช่ NULL -> ต้องมีอยู่จริงใน rooms
    if (wantUpdateRoom && roomIdNormalized !== null) {
      const [[r]] = await db.query('SELECT room_id FROM rooms WHERE room_id = ?', [roomIdNormalized]);
      if (!r) {
        return res.status(400).json({
          error: 'Invalid room_id: room does not exist',
          code: 'ROOM_NOT_FOUND'
        });
      }
    }

    // 4) สร้าง SQL อัปเดตเฉพาะฟิลด์ที่ต้องการ
    if (wantUpdateRoom || wantUpdateCheckin) {
      await db.query(
        'UPDATE tenants SET ' +
          (wantUpdateRoom ? 'room_id = ?, ' : '') +
          (wantUpdateCheckin ? 'checkin_date = ?, ' : '') +
          'tenant_id = tenant_id ' + // no-op เพื่อจัดคอมม่าได้ง่าย
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
    next(e);
  }
}


// -----------------------------------------------------
// DELETE /api/admin/tenants/:id
// - Soft delete: is_deleted = 1 (หลีกเลี่ยงปัญหา FK กับ repairs)
// -----------------------------------------------------
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

// -----------------------------------------------------
// Exports
// -----------------------------------------------------
module.exports = {
  listTenants,
  createTenant,
  updateTenant,
  deleteTenant,
};
