const db = require('../config/db');

// GET /api/admin/tenants  (admin) — รายชื่อผู้เช่าปัจจุบันพร้อมข้อมูลห้อง
exports.listTenants = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const [rows] = await db.query(`
      SELECT
        t.tenant_id,
        t.user_id,
        t.room_id,
        t.checkin_date,
        u.name AS user_name,
        u.email,
        u.phone,
        r.room_number
      FROM tenants t
      JOIN users u ON u.id = t.user_id
      JOIN rooms r ON r.room_id = t.room_id
      ORDER BY t.checkin_date DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error('[listTenants] error:', err);
    res.status(500).json({ error: 'Failed to fetch tenants' });
  }
};
