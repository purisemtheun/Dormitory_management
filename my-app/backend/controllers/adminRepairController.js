const db = require("../config/db");
const STATUS = require("./repairStatus");
const { pushLineAfterNotification } = require('../services/notifyAfterInsert');

/* ======================================================
 * 1) สร้างใบแจ้งซ่อม  (⚡️เพิ่ม: แจ้งเตือน + LINE)
 * ====================================================== */
exports.createRepair = async (req, res) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;
    if (!userId) return res.status(401).json({ message: "ยังไม่ได้เข้าสู่ระบบ" });

    const { room_id, title, description, image_url } = req.body || {};
    if (!title || !description)
      return res.status(400).json({ message: "กรุณาระบุเรื่องและรายละเอียดการแจ้งซ่อม" });

    let tenant_id = null;
    let tenant_room_id = null;

    if (role === "tenant") {
      const [rows] = await db.query(
        `SELECT tenant_id, room_id
           FROM tenants
          WHERE user_id = ?
            AND (is_deleted = 0 OR is_deleted IS NULL)
          ORDER BY COALESCE(checkin_date, '1970-01-01') DESC, tenant_id DESC
          LIMIT 1`,
        [userId]
      );
      if (!rows.length)
        return res.status(403).json({ message: "บัญชีนี้ยังไม่เชื่อมผู้เช่า (tenant)" });
      tenant_id = rows[0].tenant_id;
      tenant_room_id = rows[0].room_id || null;
    }

    let finalImageUrl = image_url || null;
    if (req.file?.filename) finalImageUrl = `/uploads/repairs/${req.file.filename}`;

    const effectiveRoomId = room_id || tenant_room_id || null;

    const [ins] = await db.query(
      `INSERT INTO repairs
         (room_id, tenant_id, title, description, image_url, status, created_at, updated_at)
       VALUES
         (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [effectiveRoomId, tenant_id, title, description, finalImageUrl, STATUS.NEW]
    );

    // ⚡️ แจ้งเตือนผู้เช่าทันที (ถ้าทราบ tenant_id)
    if (tenant_id) {
      const type  = 'repair_updated';
      const ntitle = 'รับเรื่องแจ้งซ่อมเรียบร้อย';
      const body  = effectiveRoomId
        ? `ห้อง: ${effectiveRoomId}\nเรื่อง: ${title}`
        : `เรื่อง: ${title}`;

      await db.query(
        `INSERT INTO notifications
           (tenant_id, type, title, body, ref_type, ref_id, status, created_at)
         VALUES
           (?, ?, ?, ?, 'repair', ?, 'unread', NOW())`,
        [tenant_id, type, ntitle, body, ins.insertId]
      );
      await pushLineAfterNotification(null, {
        tenant_id, type, title: ntitle, body
      });
    }

    res.status(201).json({ message: "สร้างใบแจ้งซ่อมสำเร็จ", repair_id: ins.insertId });
  } catch (err) {
    console.error("❌ createRepair error:", err);
    res.status(500).json({ message: "เกิดข้อผิดพลาดในการสร้างใบแจ้งซ่อม" });
  }
};

/* ======================================================
 * 2) ดึงรายการซ่อมทั้งหมด (กรองตาม role)
 * ====================================================== */
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
      LEFT JOIN rooms   rm  ON rm.room_id   = r.room_id
      LEFT JOIN tenants t   ON t.tenant_id  = r.tenant_id
      LEFT JOIN users   tu  ON tu.id        = t.user_id
      LEFT JOIN users   tech ON tech.id     = COALESCE(r.assigned_technician_id, r.assigned_to)
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
      LEFT JOIN rooms   rm  ON rm.room_id   = r.room_id
      LEFT JOIN tenants t   ON t.tenant_id  = r.tenant_id
      LEFT JOIN users   tu  ON tu.id        = t.user_id
      LEFT JOIN users   tech ON tech.id     = COALESCE(r.assigned_technician_id, r.assigned_to)
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
    const { id } = req.params; // repair_id
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
    const { id } = req.params; // repair_id
    await db.query("DELETE FROM repairs WHERE repair_id = ?", [id]);
    res.json({ message: "ลบงานซ่อมเรียบร้อยแล้ว" });
  } catch (err) {
    console.error("❌ deleteRepair error:", err);
    res.status(500).json({ message: "ไม่สามารถลบงานซ่อมได้" });
  }
};

/* ======================================================
 * 6) รายชื่อช่าง
 * ====================================================== */
exports.listTechnicians = async (_req, res) => {
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
 * 7) มอบหมายงาน (admin/manager)  (⚡️เพิ่ม: แจ้งเตือน + LINE)
 * ====================================================== */
exports.assignRepair = async (req, res) => {
  try {
    const { id } = req.params; // repair_id
    const techId = req.body.assigned_to ?? req.body.technician_id;
    if (!techId) return res.status(400).json({ error: "ต้องระบุ assigned_to" });

    const [chk] = await db.query("SELECT status FROM repairs WHERE repair_id = ? LIMIT 1", [id]);
    if (!chk.length) return res.status(404).json({ message: "ไม่พบงานซ่อมนี้" });

    await db.query(
      `UPDATE repairs
          SET assigned_technician_id = ?, status = ?, updated_at = NOW()
        WHERE repair_id = ?`,
      [Number(techId), STATUS.ASSIGNED, id]
    );

    // ⚡️ แจ้งเตือนผู้เช่า ว่างานถูกมอบหมายแล้ว
    const [[info]] = await db.query(
      `SELECT tenant_id, room_id, title FROM repairs WHERE repair_id = ? LIMIT 1`,
      [id]
    );
    if (info?.tenant_id) {
      const type  = 'repair_updated';
      const title = 'มอบหมายช่างเรียบร้อย';
      const body  = info.title
        ? `งาน "${info.title}" (${info.room_id || '-'}) อยู่ระหว่างเตรียมดำเนินการ`
        : `งานซ่อม (${info.room_id || '-'}) อยู่ระหว่างเตรียมดำเนินการ`;

      await db.query(
        `INSERT INTO notifications
           (tenant_id, type, title, body, ref_type, ref_id, status, created_at)
         VALUES
           (?, ?, ?, ?, 'repair', ?, 'unread', NOW())`,
        [info.tenant_id, type, title, body, id]
      );
      await pushLineAfterNotification(null, {
        tenant_id: info.tenant_id, type, title, body
      });
    }

    res.json({ message: "มอบหมายงานให้ช่างสำเร็จ" });
  } catch (err) {
    console.error("❌ assignRepair error:", err);
    res.status(500).json({ message: "เกิดข้อผิดพลาดในการมอบหมายงาน" });
  }
};

/* ======================================================
 * 8) แอดมินเปลี่ยนสถานะ (สำหรับ rejected ฯลฯ) (⚡️เพิ่ม: แจ้งเตือน + LINE)
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

    // ⚡️ แจ้งเตือนบางสถานะ
    if ([STATUS.REJECTED, STATUS.CANCELLED, STATUS.ASSIGNED].includes(status)) {
      const [[info]] = await db.query(
        `SELECT tenant_id, room_id, title FROM repairs WHERE repair_id = ? LIMIT 1`,
        [id]
      );
      if (info?.tenant_id) {
        const type  = 'repair_updated';
        const title = status === STATUS.REJECTED
          ? 'คำขอซ่อมถูกปฏิเสธ'
          : status === STATUS.CANCELLED
          ? 'ยกเลิกคำขอซ่อม'
          : 'มอบหมายช่างเรียบร้อย';
        const body  =
          info.title
            ? `งาน "${info.title}" (${info.room_id || '-'}) สถานะ: ${status}`
            : `งานซ่อม (${info.room_id || '-'}) สถานะ: ${status}`;

        await db.query(
          `INSERT INTO notifications
             (tenant_id, type, title, body, ref_type, ref_id, status, created_at)
           VALUES
             (?, ?, ?, ?, 'repair', ?, 'unread', NOW())`,
          [info.tenant_id, type, title, body, id]
        );
        await pushLineAfterNotification(null, {
          tenant_id: info.tenant_id, type, title, body
        });
      }
    }

    res.json({ message: `อัปเดตสถานะเป็น ${status} สำเร็จ` });
  } catch (err) {
    console.error("❌ adminSetStatus error:", err);
    res.status(500).json({ message: "ไม่สามารถอัปเดตสถานะได้" });
  }
};

/* ======================================================
 * 9) ช่างเปลี่ยนสถานะ (เริ่ม/เสร็จสิ้น) + แจ้งเตือนเมื่อเริ่มและเสร็จ
 * ====================================================== */
exports.techSetStatus = async (req, res) => {
  try {
    const repairId = req.params.id;
    const techId = req.user.id;
    const { action, status } = req.body || {};

    const want =
      action === "start" || String(status || "").toLowerCase() === "in_progress"
        ? "in_progress"
        : action === "complete" || String(status || "").toLowerCase() === "done"
        ? "done"
        : null;

    if (!want) return res.status(400).json({ error: "action ต้องเป็น start หรือ complete" });

    // ตรวจสิทธิ์เจ้าของงานสำหรับช่าง
    const [own] = await db.query(
      `SELECT status
         FROM repairs
        WHERE repair_id = ?
          AND COALESCE(assigned_technician_id, assigned_to) = ?
        LIMIT 1`,
      [repairId, techId]
    );
    if (!own.length) {
      return res.status(403).json({ error: "คุณไม่ได้รับมอบหมายงานนี้ หรือไม่พบนายซ่อม" });
    }
    const current = String(own[0].status || "").toLowerCase();
    if (want === "in_progress" && current !== "assigned") {
      return res.status(409).json({ error: `สถานะปัจจุบันคือ '${current}' (ต้องเป็น 'assigned')` });
    }
    if (want === "done" && current !== "in_progress") {
      return res.status(409).json({ error: `สถานะปัจจุบันคือ '${current}' (ต้องเป็น 'in_progress')` });
    }

    await db.query(
      `UPDATE repairs
          SET status = ?,
              started_at   = IF(? = 'in_progress', NOW(), started_at),
              completed_at = IF(? = 'done',        NOW(), completed_at),
              updated_at   = NOW()
        WHERE repair_id = ?`,
      [want, want, want, repairId]
    );

    // ⚡️ แจ้งเตือนเมื่อเริ่มดำเนินการ / เสร็จสิ้น
    const [[info]] = await db.query(
      `SELECT tenant_id, room_id, title FROM repairs WHERE repair_id = ? LIMIT 1`,
      [repairId]
    );
    if (info?.tenant_id) {
      const type  = 'repair_updated';
      const title = want === 'in_progress' ? 'ช่างเริ่มดำเนินการซ่อม' : 'งานซ่อมเสร็จแล้ว';
      const body  =
        info.title
          ? `งาน "${info.title}" (${info.room_id || '-'}) ${want === 'in_progress' ? 'กำลังดำเนินการ' : 'เสร็จสิ้นเรียบร้อย'}`
          : `งานซ่อม (${info.room_id || '-'}) ${want === 'in_progress' ? 'กำลังดำเนินการ' : 'เสร็จสิ้นเรียบร้อย'}`;

      await db.query(
        `INSERT INTO notifications
           (tenant_id, type, title, body, ref_type, ref_id, status, created_at)
         VALUES
           (?, ?, ?, ?, 'repair', ?, 'unread', NOW())`,
        [info.tenant_id, type, title, body, repairId]
      );
      await pushLineAfterNotification(null, {
        tenant_id: info.tenant_id, type, title, body
      });
    }

    return res.json({ message: "อัปเดตสถานะสำเร็จ", repair_id: repairId, status: want });
  } catch (err) {
    console.error("🔥 [techSetStatus] error:", err);
    return res.status(500).json({ error: "เกิดข้อผิดพลาดในการอัปเดตสถานะ" });
  }
};
