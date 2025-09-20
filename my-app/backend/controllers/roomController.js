// backend/controllers/roomController.js
const db = require('../config/db');

// ===== Helper: สร้าง tenant_id ถ้าไม่มีแถวเดิมให้ update =====
// รูปแบบ: T0001, T0002, ...
async function makeTenantId() {
  const [[row]] = await db.query(
    "SELECT MAX(CAST(REPLACE(tenant_id,'T','') AS UNSIGNED)) AS maxn FROM tenants"
  );
  const next = (row?.maxn || 0) + 1;
  return 'T' + String(next).padStart(4, '0');
}

// (ตัวอย่าง) ดึงห้องทั้งหมด
exports.listRooms = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT room_id, room_number, price, status, has_fan, has_aircon, has_fridge FROM rooms ORDER BY room_id ASC'
    );
    res.json(rows);
  } catch (e) {
    console.error('listRooms error:', e);
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
};

// (ตัวอย่าง) สร้างห้อง
exports.createRoom = async (req, res) => {
  try {
    const { room_id, room_number, price, status = 'available', has_fan = false, has_aircon = false, has_fridge = false } = req.body;
    if (!room_id || !room_number) return res.status(400).json({ error: 'room_id และ room_number จำเป็นต้องมี' });

    await db.query(
      'INSERT INTO rooms (room_id, room_number, price, status, has_fan, has_aircon, has_fridge) VALUES (?,?,?,?,?,?,?)',
      [room_id, room_number, price ?? null, status, !!has_fan, !!has_aircon, !!has_fridge]
    );
    res.status(201).json({ message: 'created' });
  } catch (e) {
    console.error('createRoom error:', e);
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
};

// (ตัวอย่าง) อัปเดตห้อง
exports.updateRoom = async (req, res) => {
  try {
    const id = req.params.id;
    const { room_number, price, status, has_fan, has_aircon, has_fridge } = req.body;

    const [ret] = await db.query(
      `UPDATE rooms SET
        room_number = COALESCE(?, room_number),
        price       = COALESCE(?, price),
        status      = COALESCE(?, status),
        has_fan     = COALESCE(?, has_fan),
        has_aircon  = COALESCE(?, has_aircon),
        has_fridge  = COALESCE(?, has_fridge)
       WHERE room_id = ?`,
      [room_number ?? null, price ?? null, status ?? null, has_fan, has_aircon, has_fridge, id]
    );
    if (ret.affectedRows === 0) return res.status(404).json({ error: 'Room not found' });
    res.json({ message: 'updated' });
  } catch (e) {
    console.error('updateRoom error:', e);
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
};

// (ตัวอย่าง) ลบห้อง
exports.deleteRoom = async (req, res) => {
  try {
    const id = req.params.id;
    const [ret] = await db.query('DELETE FROM rooms WHERE room_id = ?', [id]);
    if (ret.affectedRows === 0) return res.status(404).json({ error: 'Room not found' });
    res.json({ message: 'deleted' });
  } catch (e) {
    console.error('deleteRoom error:', e);
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
};

// ===== ✅ ฟังก์ชันสำคัญข้อ 3: ผูกห้องให้ผู้เช่า =====
exports.bookRoomForTenant = async (req, res) => {
  try {
    const roomId = req.params.id;                 // :id จาก URL (เช่น A103)
    const { userId, checkin_date } = req.body;    // body: { userId, checkin_date? }
    if (!userId) return res.status(400).json({ error: 'ต้องมี userId' });

    const today = new Date().toISOString().slice(0, 10);
    const checkinDate = checkin_date || today;

    // 1) ห้องต้องมีและยังไม่ถูกย้ายเข้า
    const [[room]] = await db.query('SELECT room_id, status FROM rooms WHERE room_id = ?', [roomId]);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (room.status === 'occupied') return res.status(400).json({ error: 'Room already occupied' });

    // 2) ผู้ใช้ต้องมีจริง
    const [[user]] = await db.query('SELECT id, role FROM users WHERE id = ?', [userId]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // 3) ห้องนี้ยังไม่มีผู้เช่า
    const [roomTenant] = await db.query('SELECT tenant_id FROM tenants WHERE room_id = ? LIMIT 1', [roomId]);
    if (roomTenant.length) return res.status(400).json({ error: 'Room already has a tenant' });

    // 4) ถ้าผู้ใช้นี้เคย check-in ห้องใดไว้แล้ว (room_id ไม่ว่าง) ให้บล็อก
    const [existAssigned] = await db.query(
      'SELECT tenant_id FROM tenants WHERE user_id = ? AND room_id IS NOT NULL LIMIT 1',
      [userId]
    );
    if (existAssigned.length) {
      return res.status(400).json({ error: 'User already checked-in' });
    }

    // 5) พยายามอัปเดตแถว tenants เดิมที่ room_id ยังว่าง (NULL/'') -> set room_id และ checkin_date
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
      // อัปเดตสำเร็จ -> ดึง tenant_id เพื่อตอบกลับ
      const [[row]] = await db.query(
        'SELECT tenant_id FROM tenants WHERE user_id = ? AND room_id = ? LIMIT 1',
        [userId, roomId]
      );
      tenantId = row?.tenant_id || null;
      mode = 'updated';
    } else {
      // ไม่มีแถวเดิม -> แทรกใหม่
      const tenantIdNew = await makeTenantId();
      await db.query(
        'INSERT INTO tenants (tenant_id, user_id, room_id, checkin_date) VALUES (?,?,?,?)',
        [tenantIdNew, userId, roomId, checkinDate]
      );
      tenantId = tenantIdNew;
      mode = 'inserted';
    }

    // 6) อัปเดตสถานะห้องเป็น occupied
    await db.query('UPDATE rooms SET status = ? WHERE room_id = ?', ['occupied', roomId]);

    return res.status(201).json({ message: 'Check-in success', tenant_id: tenantId, mode });
  } catch (err) {
    console.error('bookRoomForTenant error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
};
