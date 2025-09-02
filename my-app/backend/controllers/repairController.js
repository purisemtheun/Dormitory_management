// controllers/repairController.js
const db = require('../config/db');

// ===== Helpers =====
function makeRepairId() {
  const now = new Date();
  const y = String(now.getFullYear()).slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rnd = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  return `R${y}${m}${d}${rnd}`; // ยาว 10 ตัว
}

// รับ 'YYYY-MM-DD' หรือ ISO อื่น ๆ แล้วคืน 'YYYY-MM-DD'
function toDateOnly(str) {
  if (!str) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(str);
  if (isNaN(d.getTime())) return null;
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// ===== Controllers =====
exports.createRepair = async (req, res) => {
  try {
    const { title, description, room_id: roomIdInput, image_url } = req.body;
    const dueRaw = req.body.due_date || req.body.deadline; // รองรับทั้งสองชื่อ

    if (!req.user?.id) {
      return res.status(401).json({ error: 'ยังไม่ได้เข้าสู่ระบบหรือ token หมดอายุ' });
    }
    if (!title || !description) {
      return res.status(400).json({ error: 'title และ description จำเป็นต้องมี' });
    }

    // หา tenant ของผู้ใช้ (ใช้ล่าสุด)
    const userId = req.user.id;
    const [tenants] = await db.query(
      'SELECT tenant_id, room_id FROM tenants WHERE user_id = ? ORDER BY checkin_date DESC LIMIT 1',
      [userId]
    );
    const tenant = tenants[0];
    if (!tenant) {
      return res.status(404).json({ error: 'ยังไม่ได้เชื่อม tenant กับผู้ใช้งานนี้' });
    }

    // room_id: tenant ต้องแจ้งห้องของตนเอง
    let roomId = roomIdInput || tenant.room_id || null;
    if (req.user.role === 'tenant') {
      if (!tenant.room_id) {
        return res.status(400).json({ error: 'บัญชีผู้เช่ายังไม่ถูกผูกกับห้อง จึงแจ้งซ่อมไม่ได้' });
      }
      if (roomId !== tenant.room_id) {
        return res.status(403).json({ error: 'คุณไม่มีสิทธิ์แจ้งซ่อมห้องอื่น' });
      }
    }
    if (!roomId) {
      return res.status(400).json({ error: 'ต้องระบุ room_id' });
    }

    const dueDate = toDateOnly(dueRaw);
    if (dueRaw && !dueDate) {
      return res.status(400).json({ error: 'รูปแบบ due_date/deadline ไม่ถูกต้อง (ควรเป็น YYYY-MM-DD หรือ ISO ที่พาร์สได้)' });
    }

    const finalImageUrl = image_url || null;

    // สร้าง repair_id (กันชนด้วย UNIQUE KEY ที่ DB)
    let repairId = makeRepairId();
    for (let i = 0; i < 3; i++) {
      try {
        await db.query(
          `INSERT INTO repairs
            (repair_id, tenant_id, description, assigned_to, status, created_at, updated_at,
             title, room_id, image_url, due_date)
           VALUES ( ?, ?, ?, NULL, 'new', NOW(), NOW(),
                    ?, ?, ?, ? )`,
          [repairId, tenant.tenant_id, description, title, roomId, finalImageUrl, dueDate]
        );
        break; // สำเร็จ
      } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') { repairId = makeRepairId(); continue; }
        throw e;
      }
    }

    return res.status(201).json({
      message: 'สร้างใบแจ้งซ่อมสำเร็จ',
      data: {
        repair_id: repairId,
        title,
        description,
        room_id: roomId,
        image_url: finalImageUrl,
        due_date: dueDate,
        status: 'new',
      },
    });
  } catch (err) {
    console.error('🔥 [createRepair] error:', err);
    return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการสร้างใบแจ้งซ่อม' });
  }
};

exports.getAllRepairs = async (req, res) => {
  try {
    const { role, id: userId } = req.user;

    if (role === 'tenant') {
      const [trows] = await db.query(
        'SELECT tenant_id FROM tenants WHERE user_id = ? ORDER BY checkin_date DESC LIMIT 1',
        [userId]
      );
      const t = trows[0];
      if (!t) return res.status(404).json({ error: 'ยังไม่ได้เชื่อม tenant กับผู้ใช้งานนี้' });

      const [rows] = await db.query(
        `SELECT r.repair_id, r.title, r.description, r.room_id, r.image_url, r.due_date,
                r.status, r.created_at, r.updated_at, r.assigned_to,
                u.name AS technician_name
         FROM repairs r
         LEFT JOIN users u ON u.id = r.assigned_to
         WHERE r.tenant_id = ?
         ORDER BY r.created_at DESC`,
        [t.tenant_id]
      );
      return res.json(rows);
    }

    if (role === 'technician') {
      // ✅ ช่างเห็นเฉพาะงานที่ถูกมอบหมายให้ตนเองเท่านั้น
      const [rows] = await db.query(
        `SELECT r.repair_id, r.title, r.description, r.room_id, r.image_url, r.due_date,
                r.status, r.created_at, r.updated_at, r.assigned_to,
                u.name AS technician_name
         FROM repairs r
         LEFT JOIN users u ON u.id = r.assigned_to
         WHERE r.assigned_to = ?
         ORDER BY r.created_at DESC`,
        [userId]
      );
      return res.json(rows);
    }

    // admin → เห็นทั้งหมด
    const [rows] = await db.query(
      `SELECT r.repair_id, r.title, r.description, r.room_id, r.image_url, r.due_date,
              r.status, r.created_at, r.updated_at, r.assigned_to,
              u.name AS technician_name
       FROM repairs r
       LEFT JOIN users u ON u.id = r.assigned_to
       ORDER BY r.created_at DESC`
    );
    return res.json(rows);
  } catch (err) {
    console.error('🔥 [getAllRepairs] error:', err);
    return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงรายการซ่อม' });
  }
};


exports.getRepairById = async (req, res) => {
  try {
    const { role, id: userId } = req.user;
    const { id: repairId } = req.params;

    const [rrows] = await db.query(
      `SELECT r.repair_id, r.title, r.description, r.room_id, r.image_url, r.due_date,
              r.status, r.created_at, r.updated_at, r.tenant_id, r.assigned_to,
              u.name AS technician_name
       FROM repairs r
       LEFT JOIN users u ON u.id = r.assigned_to
       WHERE r.repair_id = ? LIMIT 1`,
      [repairId]
    );
    const repair = rrows[0];
    if (!repair) return res.status(404).json({ error: 'Repair not found' });

    if (role === 'tenant') {
      const [trows] = await db.query(
        'SELECT tenant_id FROM tenants WHERE user_id = ? ORDER BY checkin_date DESC LIMIT 1',
        [userId]
      );
      const t = trows[0];
      if (!t || repair.tenant_id !== t.tenant_id) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    if (role === 'technician' && repair.assigned_to !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    return res.json(repair);
  } catch (err) {
    console.error('🔥 [getRepairById] error:', err);
    return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงรายละเอียดซ่อม' });
  }
};

exports.assignRepair = async (req, res) => {
  try {
    const { assigned_to } = req.body;
    const { id: repairId } = req.params;
    if (!assigned_to) return res.status(400).json({ error: 'ต้องระบุ assigned_to' });

    // ตรวจว่าช่างมีจริง
    const [urows] = await db.query('SELECT id FROM users WHERE id = ? LIMIT 1', [assigned_to]);
    if (!urows.length) return res.status(404).json({ error: 'ไม่พบบุคคลที่ระบุ' });

    // ดึงงานมาก่อน
    const [rows] = await db.query(
      'SELECT repair_id, status, assigned_to FROM repairs WHERE repair_id = ? LIMIT 1',
      [repairId]
    );
    const job = rows[0];
    if (!job) return res.status(404).json({ error: 'ไม่พบงานซ่อม' });

    // (ออปชัน) บังคับให้มอบหมายได้เฉพาะงานใหม่
    // if (job.status !== 'new') {
    //   return res.status(409).json({ error: 'งานไม่อยู่ในสถานะ new', current_status: job.status });
    // }

    // ถ้าค่าเดิมเป็นคนเดียวกัน → ถือว่าสำเร็จ (idempotent)
    if (job.assigned_to === Number(assigned_to)) {
      return res.status(200).json({ message: 'มอบหมายงานสำเร็จ (เดิมอยู่แล้ว)', idempotent: true });
    }

    const [result] = await db.query(
      'UPDATE repairs SET assigned_to = ?, updated_at = NOW() WHERE repair_id = ? LIMIT 1',
      [assigned_to, repairId]
    );

    if (result.affectedRows !== 1) {
      return res.status(409).json({ error: 'มอบหมายไม่ได้ (ไม่พบงาน หรือมีคนแก้ไขไปแล้ว)' });
    }
    return res.json({ message: 'มอบหมายงานสำเร็จ' });
  } catch (err) {
    console.error('🔥 [assignRepair] error:', err);
    return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการมอบหมายงาน' });
  }
};


exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const { id: repairId } = req.params;

    const allowed = new Set(['new', 'in_progress', 'completed', 'cancelled']);
    if (!allowed.has(status)) {
      return res.status(400).json({ error: 'สถานะไม่ถูกต้อง (new, in_progress, completed, cancelled)' });
    }

    await db.query(
      'UPDATE repairs SET status = ?, updated_at = NOW() WHERE repair_id = ?',
      [status, repairId]
    );
    return res.json({ message: 'อัปเดตสถานะสำเร็จ' });
  } catch (err) {
    console.error('🔥 [updateStatus] error:', err);
    return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการอัปเดตสถานะ' });
  }
};

// controllers/repairController.js
exports.deleteRepair = async (req, res) => {
  try {
    // เผื่อ route ยังไม่ได้ใช้ authorizeRoles('admin')
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden', code: 'ROLE_FORBIDDEN' });
    }

    const { id: repairId } = req.params;
    if (!repairId) {
      return res.status(400).json({ error: 'Missing repair id', code: 'BAD_REQUEST' });
    }

    const [result] = await db.query(
      'DELETE FROM repairs WHERE repair_id = ? LIMIT 1',
      [repairId]
    );

    if (result.affectedRows !== 1) {
      return res.status(404).json({ error: 'Repair not found', code: 'NOT_FOUND' });
    }

    // เลือกอย่างใดอย่างหนึ่ง:
    // return res.status(204).send(); // No Content
    return res.json({ message: 'ลบงานซ่อมสำเร็จ' });
  } catch (e) {
    console.error('🔥 [deleteRepair] error:', e);
    return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการลบงานซ่อม' });
  }
};

