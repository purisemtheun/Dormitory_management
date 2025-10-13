// backend/controllers/repairController.js
const db = require("../config/db");
const STATUS = require("./repairStatus");

/* ======================================================
 * 1) สร้างใบแจ้งซ่อม
 * ====================================================== */
exports.createRepair = async (req, res) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;
    if (!userId) return res.status(401).json({ message: "ยังไม่ได้เข้าสู่ระบบ" });

    const { room_id, title, description, image_url } = req.body;
    if (!title || !description)
      return res.status(400).json({ message: "กรุณาระบุเรื่องและรายละเอียดการแจ้งซ่อม" });

    let tenant_id = null;
    if (role === "tenant") {
      const [rows] = await db.query(
        "SELECT id FROM tenants WHERE user_id = ? ORDER BY checkin_date DESC LIMIT 1",
        [userId]
      );
      if (!rows.length)
        return res.status(403).json({ message: "บัญชีนี้ยังไม่เชื่อมผู้เช่า (tenant)" });
      tenant_id = rows[0].id;
    }

    let finalImageUrl = image_url || null;
    if (req.file?.filename) finalImageUrl = `/uploads/repairs/${req.file.filename}`;

    await db.query(
      `INSERT INTO repairs (room_id, tenant_id, title, description, image_url, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [room_id || null, tenant_id, title, description, finalImageUrl, STATUS.NEW]
    );

    res.status(201).json({ message: "สร้างใบแจ้งซ่อมสำเร็จ" });
  } catch (err) {
    console.error("❌ createRepair error:", err);
    res.status(500).json({ message: "เกิดข้อผิดพลาดในการสร้างใบแจ้งซ่อม" });
  }
};

/* ======================================================
 * 2) ดึงรายการซ่อมทั้งหมด (กรองตาม role)
 * ====================================================== */
// ดึงรายการซ่อมทั้งหมด (filter ตาม role)
exports.getAllRepairs = async (req, res) => {
  try {
    const role = req.user.role;
    const userId = req.user.id;

    let sql = `
      SELECT 
        r.*,
        rm.room_number AS room_no,
        COALESCE(NULLIF(tu.fullname,''), NULLIF(tu.name,''), tu.email) AS tenant_name,
        COALESCE(NULLIF(tech.fullname,''), NULLIF(tech.name,''), tech.email) AS technician_name,
        COALESCE(r.assigned_technician_id, r.assigned_to) AS assigned_to
      FROM repairs r
      LEFT JOIN rooms rm   ON rm.room_id    = r.room_id
      LEFT JOIN tenants t  ON t.tenant_id   = r.tenant_id          -- ✅ แก้ตรงนี้
      LEFT JOIN users tu   ON tu.id         = t.user_id
      LEFT JOIN users tech ON tech.id       = COALESCE(r.assigned_technician_id, r.assigned_to)
      WHERE 1=1
    `;
    const params = [];

    if (role === "tenant") {
      sql += " AND r.tenant_id IN (SELECT tenant_id FROM tenants WHERE user_id = ?)";
      params.push(userId);
    } else if (role === "technician") {
      sql += " AND COALESCE(r.assigned_technician_id, r.assigned_to) = ?";
      params.push(userId);
    }

    sql += " ORDER BY r.created_at DESC";

    const [rows] = await db.query(sql, params);
    const out = rows.map(r => ({ ...r, status: String(r.status || '').toLowerCase() }));
    res.json(out);
  } catch (err) {
    console.error("❌ getAllRepairs error:", err);
    res.status(500).json({ message: "ไม่สามารถดึงรายการแจ้งซ่อมได้" });
  }
};

// ดึงรายละเอียดงานซ่อมทีละรายการ
exports.getRepairById = async (req, res) => {
  try {
    const { id } = req.params; // repair_id
    const [rows] = await db.query(
      `
      SELECT 
        r.*,
        rm.room_number AS room_no,
        COALESCE(NULLIF(tu.fullname,''), NULLIF(tu.name,''), tu.email) AS tenant_name,
        COALESCE(NULLIF(tech.fullname,''), NULLIF(tech.name,''), tech.email) AS technician_name,
        COALESCE(r.assigned_technician_id, r.assigned_to) AS assigned_to
      FROM repairs r
      LEFT JOIN rooms rm   ON rm.room_id    = r.room_id
      LEFT JOIN tenants t  ON t.tenant_id   = r.tenant_id          -- ✅ แก้ตรงนี้
      LEFT JOIN users tu   ON tu.id         = t.user_id
      LEFT JOIN users tech ON tech.id       = COALESCE(r.assigned_technician_id, r.assigned_to)
      WHERE r.repair_id = ?
      `,
      [id]
    );
    if (!rows.length) return res.status(404).json({ message: "ไม่พบงานซ่อมนี้" });
    const r = rows[0];
    r.status = String(r.status || "").toLowerCase();
    res.json(r);
  } catch (err) {
    console.error("❌ getRepairById error:", err);
    res.status(500).json({ message: "เกิดข้อผิดพลาดในการดึงข้อมูลงานซ่อม" });
  }
};



/* ======================================================
 * 3) รายละเอียดงาน
 * ====================================================== */
exports.getRepairById = async (req, res) => {
  try {
    const { id } = req.params; // repair_id
    const [rows] = await db.query(
      `
      SELECT 
        r.*,
        rm.room_number AS room_no,
        COALESCE(NULLIF(tu.fullname,''), NULLIF(tu.name,''), tu.email) AS tenant_name,
        COALESCE(NULLIF(tech.fullname,''), NULLIF(tech.name,''), tech.email) AS technician_name,
        COALESCE(r.assigned_technician_id, r.assigned_to) AS assigned_to
      FROM repairs r
      LEFT JOIN rooms rm   ON rm.room_id    = r.room_id
      LEFT JOIN tenants t  ON t.tenant_id   = r.tenant_id          -- ✅ แก้ตรงนี้
      LEFT JOIN users tu   ON tu.id         = t.user_id
      LEFT JOIN users tech ON tech.id       = COALESCE(r.assigned_technician_id, r.assigned_to)
      WHERE r.repair_id = ?
      `,
      [id]
    );
    if (!rows.length) return res.status(404).json({ message: "ไม่พบงานซ่อมนี้" });
    const r = rows[0];
    r.status = String(r.status || "").toLowerCase();
    res.json(r);
  } catch (err) {
    console.error("❌ getRepairById error:", err);
    res.status(500).json({ message: "เกิดข้อผิดพลาดในการดึงข้อมูลงานซ่อม" });
  }
};

/* ======================================================
 * 4) อัปเดตข้อมูลงาน
 * ====================================================== */
exports.updateRepair = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, image_url, room_id } = req.body;

    await db.query(
      `UPDATE repairs
       SET title = ?, description = ?, image_url = ?, room_id = ?, updated_at = NOW()
       WHERE repair_id = ?`,
      [title, description, image_url || null, room_id || null, id]
    );

    res.json({ message: "อัปเดตข้อมูลงานซ่อมสำเร็จ" });
  } catch (err) {
    console.error("❌ updateRepair error:", err);
    res.status(500).json({ message: "เกิดข้อผิดพลาดในการแก้ไขงานซ่อม" });
  }
};

/* ======================================================
 * 5) ลบงาน (admin)
 * ====================================================== */
exports.deleteRepair = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query("DELETE FROM repairs WHERE repair_id = ?", [id]);
    res.json({ message: "ลบงานซ่อมเรียบร้อยแล้ว" });
  } catch (err) {
    console.error("❌ deleteRepair error:", err);
    res.status(500).json({ message: "ไม่สามารถลบงานซ่อมได้" });
  }
};

/* ======================================================
 * 6) รายชื่อช่าง (ใช้ชื่อจริง)
 * ====================================================== */
exports.listTechnicians = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        id,
        COALESCE(NULLIF(fullname,''), NULLIF(name,''), LEFT(email, LOCATE('@', email) - 1), CONCAT('Tech#', id)) AS name,
        email
      FROM users
      WHERE role = 'technician'
        AND (status IS NULL OR LOWER(status) IN ('active','1','true'))
      ORDER BY name ASC, id ASC
    `);
    const out = rows.map(r => ({ id: r.id, name: r.name, email: r.email }));
    res.json(out);
  } catch (err) {
    console.error("❌ listTechnicians error:", err);
    res.status(500).json({ message: "ไม่สามารถดึงรายชื่อช่างได้" });
  }
};

/* ======================================================
 * 7) มอบหมายงาน (admin/manager)  ← ใช้กับ FE: PATCH /api/repairs/:id/assign
 *    รองรับทั้ง body.assigned_to และ body.technician_id
 * ====================================================== */
exports.assignRepair = async (req, res) => {
  try {
    const { id } = req.params; // repair_id
    const techId = req.body.assigned_to ?? req.body.technician_id;
    if (!techId) return res.status(400).json({ error: "ต้องระบุ assigned_to" });

    const [chk] = await db.query("SELECT status FROM repairs WHERE repair_id = ? LIMIT 1", [id]);
    if (!chk.length) return res.status(404).json({ message: "ไม่พบงานซ่อมนี้" });

    // มอบหมายได้จากสถานะ NEW/ASSIGNED (idempotent)
    await db.query(
      `UPDATE repairs
       SET assigned_technician_id = ?, status = ?, updated_at = NOW()
       WHERE repair_id = ?`,
      [Number(techId), STATUS.ASSIGNED, id]
    );

    res.json({ message: "มอบหมายงานให้ช่างสำเร็จ" });
  } catch (err) {
    console.error("❌ assignRepair error:", err);
    res.status(500).json({ message: "เกิดข้อผิดพลาดในการมอบหมายงาน" });
  }
};

/* ======================================================
 * 8) แอดมินเปลี่ยนสถานะ (ใช้สำหรับปุ่ม 'ปฏิเสธ')
 *    FE เรียก: PATCH /api/repairs/:id/status  { status: "rejected" }
 * ====================================================== */
exports.adminSetStatus = async (req, res) => {
  try {
    const { id } = req.params;        // repair_id
    const { status } = req.body || {};
    const allowed = new Set([STATUS.REJECTED, STATUS.CANCELLED, STATUS.NEW, STATUS.ASSIGNED]);
    if (!allowed.has(status)) {
      return res.status(400).json({ message: "สถานะไม่ถูกต้อง" });
    }

    await db.query(
      "UPDATE repairs SET status = ?, updated_at = NOW() WHERE repair_id = ?",
      [status, id]
    );
    res.json({ message: `อัปเดตสถานะเป็น ${status} สำเร็จ` });
  } catch (err) {
    console.error("❌ adminSetStatus error:", err);
    res.status(500).json({ message: "ไม่สามารถอัปเดตสถานะได้" });
  }
};

/* ======================================================
 * 9) ช่างเปลี่ยนสถานะ (เริ่ม/เสร็จสิ้น)
 * ====================================================== */
// ช่างอัปเดตสถานะงาน (เริ่ม/เสร็จสิ้น)
exports.techSetStatus = async (req, res) => {
  try {
    const repairId = req.params.id;
    const techId = req.user.id;
    const { action, status } = req.body || {};

    // แปลงคำขอเป็นสถานะที่ต้องการ
    const want =
      action === "start" || String(status || "").toLowerCase() === "in_progress"
        ? "in_progress"
        : action === "complete" || String(status || "").toLowerCase() === "done"
        ? "done"
        : null;

    if (!want) {
      return res.status(400).json({ error: "action ต้องเป็น start หรือ complete" });
    }

    // ดึงงานที่ 'เป็นของช่างคนนี้' เท่านั้น
    const [rows] = await db.query(
      `SELECT status
         FROM repairs
        WHERE repair_id = ?
          AND COALESCE(assigned_technician_id, assigned_to) = ? 
        LIMIT 1`,
      [repairId, techId]
    );

    if (!rows.length) {
      return res.status(403).json({ error: "คุณไม่ได้รับมอบหมายงานนี้ หรือไม่พบนายซ่อม" });
    }

    const current = String(rows[0].status || "").toLowerCase();

    // ตรวจเงื่อนไขการเปลี่ยนสถานะ
    if (want === "in_progress" && current !== "assigned") {
      return res
        .status(409)
        .json({ error: `สถานะปัจจุบันคือ '${current}' จึงเริ่มงานไม่ได้ (ต้องเป็น 'assigned')` });
    }
    if (want === "done" && current !== "in_progress") {
      return res
        .status(409)
        .json({ error: `สถานะปัจจุบันคือ '${current}' จึงเสร็จสิ้นไม่ได้ (ต้องเป็น 'in_progress')` });
    }

    // อัปเดต (บันทึกเวลาเริ่ม/เสร็จด้วย)
    await db.query(
      `UPDATE repairs
          SET status = ?,
              started_at   = IF(? = 'in_progress', NOW(), started_at),
              completed_at = IF(? = 'done',        NOW(), completed_at),
              updated_at   = NOW()
        WHERE repair_id = ?`,
      [want, want, want, repairId]
    );

    return res.json({ message: "อัปเดตสถานะสำเร็จ", repair_id: repairId, status: want });
  } catch (err) {
    console.error("🔥 [techSetStatus] error:", err);
    return res.status(500).json({ error: "เกิดข้อผิดพลาดในการอัปเดตสถานะ" });
  }
};

