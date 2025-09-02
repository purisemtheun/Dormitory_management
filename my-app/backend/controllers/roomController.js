// controllers/roomController.js
const db = require('../config/db');

const makeTenantId = () => 'T' + Date.now().toString().slice(-9); // ยาวไม่เกิน 10 ตัวอักษร

// POST /api/rooms  (admin)
exports.createRoom = async (req, res) => {
  try {
    const { room_id, room_number, type, price, status } = req.body;
    if (!room_id || !room_number || !price) {
      return res.status(400).json({ error: 'room_id, room_number, price จำเป็นต้องมี' });
    }
    await db.query(
      'INSERT INTO rooms (room_id, room_number, type, price, status) VALUES (?,?,?,?,?)',
      [room_id, room_number, type || null, price, status || 'available']
    );
    res.status(201).json({ message: 'Room created' });
  } catch (err) {
    console.error('createRoom error:', err);
    res.status(500).json({ error: err.message });
  }
};

// GET /api/rooms  (admin เห็นทั้งหมด / tenant เห็นห้องตัวเอง)
exports.getRooms = async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      const [rows] = await db.query('SELECT * FROM rooms ORDER BY room_number ASC');
      return res.json(rows);
    }
    if (req.user.role === 'tenant') {
      const [rows] = await db.query(
        `SELECT r.*
         FROM tenants t
         JOIN rooms r ON r.room_id = t.room_id
         WHERE t.user_id = ?
         ORDER BY r.room_number ASC`,
        [req.user.id]
      );
      return res.json(rows);
    }
    return res.status(403).json({ error: 'Forbidden' });
  } catch (err) {
    console.error('getRooms error:', err);
    res.status(500).json({ error: err.message });
  }
};

// GET /api/rooms/:id  (admin / tenant เจ้าของห้อง)
exports.getRoomById = async (req, res) => {
  try {
    const roomId = req.params.id;
    const [[room]] = await db.query('SELECT * FROM rooms WHERE room_id = ?', [roomId]);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    if (req.user.role === 'tenant') {
      const [[own]] = await db.query(
        'SELECT tenant_id FROM tenants WHERE user_id = ? AND room_id = ? LIMIT 1',
        [req.user.id, roomId]
      );
      if (!own) return res.status(403).json({ error: 'Forbidden' });
    }
    res.json(room);
  } catch (err) {
    console.error('getRoomById error:', err);
    res.status(500).json({ error: err.message });
  }
};

// POST /api/rooms/:id/book  (admin เท่านั้น)  ผูกผู้ใช้ -> ห้อง (check-in)
exports.bookRoomForTenant = async (req, res) => {
  try {
    const roomId = req.params.id;
    const { userId, checkin_date } = req.body;
    if (!userId) return res.status(400).json({ error: 'ต้องมี userId' });

    // ห้องต้องมีและยังไม่ถูกย้ายเข้า
    const [[room]] = await db.query('SELECT room_id, status FROM rooms WHERE room_id = ?', [roomId]);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (room.status === 'occupied') return res.status(400).json({ error: 'Room already occupied' });

    // ผู้ใช้ต้องมีจริง
    const [[user]] = await db.query('SELECT id, role FROM users WHERE id = ?', [userId]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // ผู้ใช้ต้องยังไม่ได้เป็น tenant อยู่ก่อน
    const [exist] = await db.query('SELECT tenant_id FROM tenants WHERE user_id = ? LIMIT 1', [userId]);
    if (exist.length) return res.status(400).json({ error: 'User already checked-in' });

    const tenantId = makeTenantId();
    await db.query(
      'INSERT INTO tenants (tenant_id, user_id, room_id, checkin_date) VALUES (?,?,?,?)',
      [tenantId, userId, roomId, (checkin_date || new Date().toISOString().slice(0,10))]
    );

    await db.query('UPDATE rooms SET status = ? WHERE room_id = ?', ['occupied', roomId]);

    res.status(201).json({ message: 'Check-in success', tenant_id: tenantId });
  } catch (err) {
    console.error('bookRoomForTenant error:', err);
    res.status(500).json({ error: err.message });
  }
};
