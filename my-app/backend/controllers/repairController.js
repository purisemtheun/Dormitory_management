// controllers/repairController.js
const db = require("../config/db");
const STATUS = require("./repairStatus");
const { pushLineAfterNotification } = require("../services/notifyAfterInsert");

/* ======================================================
 * 1) สร้างใบแจ้งซ่อม (รองรับ due_date)
 * ====================================================== */
exports.createRepair = async (req, res) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;
    if (!userId) return res.status(401).json({ message: "ยังไม่ได้เข้าสู่ระบบ" });

    const { room_id, title, description, image_url, due_date, deadline } = req.body || {};
    if (!title || !description) {
      return res.status(400).json({ message: "กรุณาระบุเรื่องและรายละเอียดการแจ้งซ่อม" });
    }

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

    // YYYY-MM-DD หรือ null (รองรับชื่อ deadline จากฟอร์มเก่า)
    const rawDue = due_date || deadline || null;
    const dueDateVal =
      typeof rawDue === "string" && /^\d{4}-\d{2}-\d{2}/.test(rawDue) ? rawDue : null;

    await db.query(
      `INSERT INTO repairs
         (room_id, tenant_id, title, description, image_url, due_date, status, created_at, updated_at)
       VALUES
         (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [effectiveRoomId, tenant_id, title, description, finalImageUrl, dueDateVal, STATUS.NEW]
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
    const out = rows.map((r) => ({ ...r, status: String(r.status || "").toLowerCase() }));
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
    const { id } = req.params;
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
 * 4) อัปเดตข้อมูลงาน (รองรับ due_date)
 * ====================================================== */
exports.updateRepair = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, image_url, room_id, due_date, deadline } = req.body;

    const rawDue = due_date || deadline || null;
    const dueDateVal =
      typeof rawDue === "string" && /^\d{4}-\d{2}-\d{2}/.test(rawDue) ? rawDue : null;

    await db.query(
      `UPDATE repairs
         SET title = ?, description = ?, image_url = ?, room_id = ?, due_date = ?, updated_at = NOW()
       WHERE repair_id = ?`,
      [title, description, image_url || null, room_id || null, dueDateVal, id]
    );

    res.json({ message: "อัปเดตข้อมูลงานซ่อมสำเร็จ" });
  } catch (err) {
    console.error("❌ updateRepair error:", err);
    res.status(500).json({ message: "เกิดข้อผิดพลาดในการแก้ไขงานซ่อม" });
  }
};

/* ======================================================
 * 5) ลบงาน (admin/manager/staff)
 *    - ถ้าติด FK จะเปลี่ยนเป็น cancelled แทน (กัน 500)
 * ====================================================== */
exports.deleteRepair = async (req, res) => {
  try {
    const { id } = req.params;

    await db.query("DELETE FROM repairs WHERE repair_id = ?", [id]);

    return res.json({ message: "ลบงานซ่อมเรียบร้อยแล้ว" });
  } catch (err) {
    if (err?.code === "ER_ROW_IS_REFERENCED_2" || err?.errno === 1451) {
      await db.query(
        "UPDATE repairs SET status = ?, updated_at = NOW() WHERE repair_id = ?",
        [STATUS.CANCELLED ?? "cancelled", req.params.id]
      );
      return res
        .status(200)
        .json({ message: "งานถูกยกเลิกแทนการลบ (มีการอ้างอิงอยู่)" });
    }
    console.error("❌ deleteRepair error:", err);
    return res.status(500).json({ message: "ไม่สามารถลบงานซ่อมได้" });
  }
};

/* ======================================================
 * 6) รายชื่อช่าง
 * ====================================================== */
exports.listTechnicians = async (_req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id,
              COALESCE(NULLIF(fullname,''), NULLIF(name,''), LEFT(email, LOCATE('@', email) - 1), CONCAT('Tech#', id)) AS name,
              email
         FROM users
        WHERE role IN ('technician','tech')
        ORDER BY name ASC, id ASC`
    );
    const out = rows.map((r) => ({ id: r.id, name: r.name, email: r.email }));
    res.json(out);
  } catch (err) {
    console.error("❌ listTechnicians error:", err);
    res.status(500).json({ message: "ไม่สามารถดึงรายชื่อช่างได้" });
  }
};

/* ======================================================
 * 7) มอบหมายงาน (admin/manager/staff)
 * ====================================================== */
exports.assignRepair = async (req, res) => {
  try {
    const { id } = req.params;
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

    res.json({ message: "มอบหมายงานให้ช่างสำเร็จ" });
  } catch (err) {
    console.error("❌ assignRepair error:", err);
    res.status(500).json({ message: "เกิดข้อผิดพลาดในการมอบหมายงาน" });
  }
};

/* ======================================================
 * 8) แอดมินเปลี่ยนสถานะ (rejected/cancelled/new/assigned)
 * ====================================================== */
exports.adminSetStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};
    const allowed = new Set([
      STATUS.REJECTED,
      STATUS.CANCELLED,
      STATUS.NEW,
      STATUS.ASSIGNED,
    ]);
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
 * 9) ช่างเปลี่ยนสถานะ (เริ่ม/เสร็จสิ้น) + แจ้งเตือนเมื่อเสร็จ
 * ====================================================== */
exports.techSetStatus = async (req, res) => {
  try {
    const repairId = req.params.id;
    const techId = req.user.id;
    const { action, status } = req.body || {};

    // map action/status → constant
    let wantStatus = null;
    if (action === "start" || String(status || "").toLowerCase() === "in_progress") {
      wantStatus = STATUS.IN_PROGRESS ?? "in_progress";
    } else if (action === "complete" || String(status || "").toLowerCase() === "done") {
      wantStatus = STATUS.DONE ?? "done";
    }
    if (!wantStatus) return res.status(400).json({ error: "action ต้องเป็น start หรือ complete" });

    // ตรวจสิทธิ์เจ้าของงาน
    const [own] = await db.query(
      `SELECT status
         FROM repairs
        WHERE repair_id = ?
          AND COALESCE(assigned_technician_id, assigned_to) = ?
        LIMIT 1`,
      [repairId, techId]
    );
    if (!own.length) return res.status(403).json({ error: "คุณไม่ได้รับมอบหมายงานนี้ หรือไม่พบนายซ่อม" });

    const currentRaw = own[0].status;
    const curStr = String(currentRaw || "").toUpperCase();
    const assignedStr = String(STATUS.ASSIGNED ?? "assigned").toUpperCase();
    const inProgressStr = String(STATUS.IN_PROGRESS ?? "in_progress").toUpperCase();

    if (wantStatus === (STATUS.IN_PROGRESS ?? "in_progress") && curStr !== assignedStr) {
      return res
        .status(409)
        .json({ error: `สถานะปัจจุบันคือ '${String(currentRaw)}' (ต้องเป็น '${STATUS.ASSIGNED}')` });
    }
    if (wantStatus === (STATUS.DONE ?? "done") && curStr !== inProgressStr) {
      return res
        .status(409)
        .json({ error: `สถานะปัจจุบันคือ '${String(currentRaw)}' (ต้องเป็น '${STATUS.IN_PROGRESS}')` });
    }

    await db.query(
      `UPDATE repairs
          SET status = ?,
              started_at   = IF(? = ?, NOW(), started_at),
              completed_at = IF(? = ?, NOW(), completed_at),
              updated_at   = NOW()
        WHERE repair_id = ?`,
      [
        wantStatus,
        wantStatus, STATUS.IN_PROGRESS ?? "in_progress",
        wantStatus, STATUS.DONE ?? "done",
        repairId,
      ]
    );

    // แจ้งเตือนเมื่อเสร็จสิ้น
    if (wantStatus === (STATUS.DONE ?? "done")) {
      const [[info]] = await db.query(
        `SELECT tenant_id, room_id, title FROM repairs WHERE repair_id = ? LIMIT 1`,
        [repairId]
      );
      if (info?.tenant_id) {
        const type = "repair_updated";
        const title = "งานซ่อมเสร็จแล้ว";
        const body = info.title
          ? `งาน "${info.title}" (${info.room_id || "-"}) เสร็จสิ้นเรียบร้อย`
          : `งานซ่อม (${info.room_id || "-"}) เสร็จสิ้นเรียบร้อย`;

        await db.query(
          `INSERT INTO notifications
             (tenant_id, type, title, body, ref_type, ref_id, status, created_at)
           VALUES
             (?, ?, ?, ?, 'repair', ?, 'unread', NOW())`,
          [info.tenant_id, type, title, body, repairId]
        );

        await pushLineAfterNotification(null, {
          tenant_id: info.tenant_id,
          type,
          title,
          body,
        });
      }
    }

    return res.json({ message: "อัปเดตสถานะสำเร็จ", repair_id: repairId, status: wantStatus });
  } catch (err) {
    console.error("🔥 [techSetStatus] error:", err);
    return res.status(500).json({ error: "เกิดข้อผิดพลาดในการอัปเดตสถานะ" });
  }
};
