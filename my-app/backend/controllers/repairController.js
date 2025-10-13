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
    const dueRaw = req.body.due_date || req.body.deadline;

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

    // รองรับไฟล์ที่อัปโหลด
    let finalImageUrl = image_url || null;
    if (req.file && req.file.filename) {
      finalImageUrl = `/uploads/repairs/${req.file.filename}`;
    }

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

// ===== Update (PATCH /repairs/:id)
exports.updateRepair = async (req, res) => {
  try {
    const { role, id: userId } = req.user || {};
    if (!userId) {
      return res.status(401).json({ error: 'ยังไม่ได้เข้าสู่ระบบหรือ token หมดอายุ' });
    }

    const { id: repairId } = req.params;

    // whitelist
    const allowed = new Set(['title','description','due_date','deadline','prev_updated_at','prev_updated_at_ts']);
    const badKey = Object.keys(req.body).find(k => !allowed.has(k));
    if (badKey) {
      return res.status(400).json({ error: `ไม่อนุญาตให้แก้ฟิลด์: ${badKey}` });
    }

    const title = req.body.title;
    const description = req.body.description;
    const dueInput = (req.body.due_date ?? req.body.deadline);
    const prevUpdatedAt = req.body.prev_updated_at;
    const prevUpdatedAtTs = req.body.prev_updated_at_ts;

    // ดึงงานเป้าหมาย
    const [rows] = await db.query(
      `SELECT repair_id, tenant_id, assigned_to, status, room_id, updated_at
       FROM repairs WHERE repair_id = ? LIMIT 1`,
      [repairId]
    );
    const r = rows[0];
    if (!r) return res.status(404).json({ error: 'ไม่พบงานซ่อม' });

    // ตรวจสิทธิ์
    if (role === 'tenant') {
      const [trows] = await db.query(
        'SELECT tenant_id FROM tenants WHERE user_id = ? ORDER BY checkin_date DESC LIMIT 1',
        [userId]
      );
      const t = trows[0];
      if (!t || t.tenant_id !== r.tenant_id) return res.status(403).json({ error: 'Forbidden' });
      if (r.status !== 'new' || r.assigned_to !== null) {
        return res.status(409).json({ error: 'แก้ไขไม่ได้หลังถูกมอบหมายหรือเริ่มงานแล้ว', current_status: r.status });
      }
    } else if (role === 'technician') {
      return res.status(403).json({ error: 'ช่างไม่สามารถแก้ไขหัวข้อ/คำอธิบาย/กำหนดเส้นตาย' });
    } else if (!['admin', 'manager'].includes(role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // เตรียมฟิลด์
    const fields = [];
    const params = [];

    if (title !== undefined) {
      fields.push('title = ?');
      params.push(String(title).trim());
    }
    if (description !== undefined) {
      fields.push('description = ?');
      params.push(description);
    }
    if (dueInput !== undefined) {
      const d = toDateOnly(dueInput);
      if (dueInput && !d) {
        return res.status(400).json({ error: 'รูปแบบ due_date/deadline ไม่ถูกต้อง (ควรเป็น YYYY-MM-DD หรือ ISO ที่พาร์สได้)' });
      }
      fields.push('due_date = ?');
      params.push(d);
    }

    if (!fields.length) {
      return res.status(400).json({ error: 'ไม่มีฟิลด์ที่จะแก้ไข (title/description/due_date)' });
    }

    // อัปเดต + optimistic lock
    let sql = `UPDATE repairs SET ${fields.join(', ')}, updated_at = NOW() WHERE repair_id = ?`;
    params.push(repairId);

    if (prevUpdatedAtTs !== undefined) {
      sql += ' AND (UNIX_TIMESTAMP(updated_at) * 1000) = ?';
      params.push(Number(prevUpdatedAtTs));
    } else if (prevUpdatedAt) {
      sql += ' AND updated_at = ?';
      params.push(new Date(prevUpdatedAt));
    }

    const [result] = await db.query(sql, params);
    if ((prevUpdatedAt || prevUpdatedAtTs !== undefined) && result.affectedRows === 0) {
      return res.status(409).json({ error: 'ข้อมูลถูกแก้ไขไปก่อนหน้าแล้ว กรุณารีเฟรช' });
    }

    const [out] = await db.query(
      `SELECT r.repair_id, r.title, r.description, r.room_id, r.image_url, r.due_date,
              r.status, r.created_at, r.updated_at, r.assigned_to,
              u.name AS technician_name
       FROM repairs r
       LEFT JOIN users u ON u.id = r.assigned_to
       WHERE r.repair_id = ? LIMIT 1`,
      [repairId]
    );

    return res.json({ message: 'อัปเดตสำเร็จ', data: out[0] });
  } catch (err) {
    console.error('🔥 [updateRepair] error:', err);
    return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการอัปเดตใบแจ้งซ่อม' });
  }
};

exports.deleteRepair = async (req, res) => {
  try {
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
    return res.json({ message: 'ลบงานซ่อมสำเร็จ' });
  } catch (e) {
    console.error('🔥 [deleteRepair] error:', e);
    return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการลบงานซ่อม' });
  }
};

// ดึงรายชื่อช่างสำหรับ dropdown
exports.listTechnicians = async (_req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        u.id,
        COALESCE(NULLIF(u.name,''), u.email, CONCAT('Tech#', u.id)) AS name,
        t.expertise,
        t.available AS available
      FROM users u
      LEFT JOIN technicians t ON t.user_id = u.id
      WHERE LOWER(u.role) = 'technician'
        AND (u.status IS NULL OR LOWER(u.status) IN ('active','1','true'))
      ORDER BY name ASC, u.id ASC
    `);

    const out = rows.map(r => ({
      id: r.id,
      name: r.name,
      expertise: r.expertise ?? null,
      available: r.available ?? 1,
    }));

    return res.json(out);
  } catch (e) {
    console.error('🔥 [listTechnicians] error:', e);
    return res.status(500).json({ error: 'โหลดรายชื่อช่างไม่สำเร็จ' });
  }
};


// ===== Technician update status =====
exports.techSetStatus = async (req, res) => {
  try {
    const { id: repairId } = req.params;
    const { action } = req.body || {};
    const { id: userId } = req.user;

    // แปลง action เป็นสถานะ
    const map = {
      start: "in_progress",
      complete: "done",
    };
    const newStatus = map[action];
    if (!newStatus)
      return res.status(400).json({ error: "action ไม่ถูกต้อง (ต้องเป็น start หรือ complete)" });

    // ตรวจว่างานนี้เป็นของช่างเอง
    const [rows] = await db.query(
      "SELECT repair_id, assigned_to, status FROM repairs WHERE repair_id = ? LIMIT 1",
      [repairId]
    );
    const r = rows[0];
    if (!r) return res.status(404).json({ error: "ไม่พบงานซ่อม" });
    if (r.assigned_to !== userId)
      return res.status(403).json({ error: "คุณไม่ได้รับมอบหมายงานนี้" });

    // ป้องกันการ complete ซ้ำ
    if (r.status === "done" && newStatus === "done") {
      return res.status(200).json({ message: "งานนี้เสร็จสิ้นแล้ว" });
    }

    // อัปเดตสถานะ
    const [result] = await db.query(
      "UPDATE repairs SET status = ?, updated_at = NOW() WHERE repair_id = ? LIMIT 1",
      [newStatus, repairId]
    );

    if (result.affectedRows !== 1)
      return res.status(409).json({ error: "อัปเดตสถานะไม่สำเร็จ" });

    return res.json({ message: "อัปเดตสถานะสำเร็จ", repair_id: repairId, status: newStatus });
  } catch (err) {
    console.error("🔥 [techSetStatus] error:", err);
    return res.status(500).json({ error: "เกิดข้อผิดพลาดในการอัปเดตสถานะ" });
  }
};
