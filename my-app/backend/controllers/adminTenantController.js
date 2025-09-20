// backend/controllers/adminTenantController.js
// =====================================================
// Controller จัดการ "รายชื่อผู้เช่า" (Tenants)
// - ไม่บังคับ email ตอนสร้างผู้เช่า (email = NULL ได้)
// - tenant_id ใช้รูปแบบ 'T0001', 'T0002', ... (สร้างเองในการ INSERT)
// - room_id เริ่มเป็น NULL (ยังไม่ผูกห้อง) และจะไปอัปเดตตอน "book room"
// - รองรับการค้นหาแบบ exact ด้วย tenant_code (T0001) และค้นหาด้วยชื่อ (LIKE)
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
// - q = 'T0001'   -> ค้นหา exact เพียงคนเดียว
// - q = 'สมชาย'  -> ค้นหาจากชื่อแบบ LIKE
// - q ว่าง        -> คืนทั้งหมด
// -----------------------------------------------------
async function listTenants(req, res, next) {
  try {
    const q = (req.query.q || '').trim();
    let sql = `
      SELECT
        ${codeExpr} AS tenant_code,
        t.tenant_id,      -- คีย์จริง ใช้สำหรับ PATCH/DELETE
        t.user_id,
        u.name,
        u.phone,
        t.room_id,
        t.checkin_date
      FROM tenants t
      JOIN users u ON u.id = t.user_id
    `;
    const params = [];

    if (/^T\d{4}$/i.test(q)) {
      // ค้นหาด้วย tenant_code แบบตรงตัว (ไม่สนพิมพ์เล็กใหญ่)
      sql += ` WHERE ${codeExpr} = ? `;
      params.push(q.toUpperCase());
    } else if (q) {
      // ค้นหาด้วยชื่อ (ส่วนมากใช้ภาษาไทย)
      sql += ` WHERE u.name LIKE ? `;
      params.push(`%${q}%`);
    }

    sql += ` ORDER BY t.tenant_id DESC`;

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (e) {
    next(e);
  }
}

// -----------------------------------------------------
// POST /api/admin/tenants
// body: { name (required), phone?, checkin_date? }
// หมายเหตุ:
//   - ไม่ต้องมี email (เราจะเก็บเป็น NULL ได้)
//   - จะสร้าง users (role='tenant') และแถว tenants โดย room_id = NULL
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

    // สร้าง tenant_id ใหม่ แล้ว INSERT แถว tenants โดย room_id = NULL
    const tenantId = await makeTenantId();
    await db.query(
      'INSERT INTO tenants (tenant_id, user_id, room_id, checkin_date) VALUES (?,?,NULL,?)',
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
// - id = tenant_id (คีย์จริงในตาราง tenants)
// - body รองรับอัปเดตบางฟิลด์: name, phone (users), room_id, checkin_date (tenants)
// - หมายเหตุ: ปกติ room_id ควรอัปเดตผ่าน flow "book room" ที่ rooms controller
// -----------------------------------------------------
async function updateTenant(req, res, next) {
  try {
    const id = req.params.id; // tenant_id
    const { name, phone, room_id, checkin_date } = req.body;

    // หา user_id ก่อนเพื่ออัปเดตตาราง users
    const [[t]] = await db.query('SELECT user_id FROM tenants WHERE tenant_id = ?', [id]);
    if (!t) {
      return res.status(404).json({ error: 'Tenant not found', code: 'TENANT_NOT_FOUND' });
    }

    // อัปเดตชื่อ/เบอร์ในตาราง users ถ้าส่งมา
    if (name != null || phone != null) {
      await db.query(
        'UPDATE users SET name = COALESCE(?, name), phone = COALESCE(?, phone) WHERE id = ?',
        [name ?? null, phone ?? null, t.user_id]
      );
    }

    // อัปเดต room_id/checkin_date ในตาราง tenants ถ้าส่งมา
    // (ถ้าอยากจำกัดให้แก้ room_id ผ่าน endpoint book-room เท่านั้น ให้ตัดส่วนนี้ทิ้ง)
    if (room_id !== undefined || checkin_date !== undefined) {
      await db.query(
        'UPDATE tenants SET room_id = COALESCE(?, room_id), checkin_date = COALESCE(?, checkin_date) WHERE tenant_id = ?',
        [room_id ?? null, checkin_date ?? null, id]
      );
    }

    res.json({ message: 'updated' });
  } catch (e) {
    next(e);
  }
}

// -----------------------------------------------------
// DELETE /api/admin/tenants/:id
// - id = tenant_id
// -----------------------------------------------------
async function deleteTenant(req, res, next) {
  try {
    const id = req.params.id;
    const [ret] = await db.query('DELETE FROM tenants WHERE tenant_id = ?', [id]);
    if (ret.affectedRows === 0) {
      return res.status(404).json({ error: 'Tenant not found', code: 'TENANT_NOT_FOUND' });
    }
    res.json({ message: 'deleted' });
  } catch (e) {
    next(e);
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
