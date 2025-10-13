// backend/controllers/adminRepairController.js
const db = require("../config/db");
const STATUS = require("./repairStatus");

/* ======================================================
 * 🧱 แอดมิน: ดูงานซ่อมที่ยังใหม่ (status = new)
 * ====================================================== */
exports.listNewRepairs = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT r.*, 
              t.fullname AS tenant_name, 
              rm.room_no
       FROM repairs r
       LEFT JOIN users t ON t.id = r.tenant_id
       LEFT JOIN rooms rm ON rm.id = r.room_id
       WHERE r.status = ?
       ORDER BY r.created_at DESC`,
      [STATUS.NEW]
    );
    res.json(rows);
  } catch (err) {
    console.error("❌ listNewRepairs error:", err);
    res.status(500).json({ message: "ไม่สามารถดึงงานใหม่ได้", error: err.message });
  }
};

/* ======================================================
 * 🧱 แอดมิน: ดูงานที่มอบหมายแล้ว (status = assigned)
 * ====================================================== */
exports.listAssignedRepairs = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT r.*, 
              u.fullname AS technician_name, 
              rm.room_no
       FROM repairs r
       LEFT JOIN users u ON u.id = r.assigned_technician_id
       LEFT JOIN rooms rm ON rm.id = r.room_id
       WHERE r.status = ?
       ORDER BY r.updated_at DESC`,
      [STATUS.ASSIGNED]
    );
    res.json(rows);
  } catch (err) {
    console.error("❌ listAssignedRepairs error:", err);
    res.status(500).json({ message: "ไม่สามารถดึงงานที่มอบหมายได้", error: err.message });
  }
};

/* ======================================================
 * 🟩 มอบหมายงานให้ช่าง
 * ====================================================== */
exports.assignRepair = async (req, res) => {
  try {
    const { id } = req.params;
    const { technician_id } = req.body;

    const [chk] = await db.query("SELECT * FROM repairs WHERE id = ?", [id]);
    if (!chk.length) return res.status(404).json({ message: "ไม่พบงานซ่อมนี้" });

    if (chk[0].status !== STATUS.NEW) {
      return res.status(400).json({ message: "มอบหมายได้เฉพาะงานที่ยังใหม่เท่านั้น" });
    }

    await db.query(
      `UPDATE repairs
       SET assigned_technician_id = ?, status = ?, updated_at = NOW()
       WHERE id = ?`,
      [technician_id, STATUS.ASSIGNED, id]
    );

    res.json({ message: "มอบหมายงานให้ช่างสำเร็จ" });
  } catch (err) {
    console.error("❌ assignRepair error:", err);
    res.status(500).json({ message: "เกิดข้อผิดพลาดในการมอบหมายงาน", error: err.message });
  }
};

/* ======================================================
 * 🟥 ปฏิเสธงานแจ้งซ่อม
 * ====================================================== */
exports.rejectRepair = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const [chk] = await db.query("SELECT status FROM repairs WHERE id = ?", [id]);
    if (!chk.length) return res.status(404).json({ message: "ไม่พบงานซ่อมนี้" });

    if (![STATUS.NEW, STATUS.ASSIGNED].includes(chk[0].status)) {
      return res.status(400).json({ message: "ปฏิเสธได้เฉพาะงานใหม่หรือที่มอบหมายแล้วเท่านั้น" });
    }

    await db.query(
      `UPDATE repairs
       SET status = ?, rejected_reason = ?, updated_at = NOW()
       WHERE id = ?`,
      [STATUS.REJECTED, reason || null, id]
    );

    res.json({ message: "ปฏิเสธงานซ่อมสำเร็จ" });
  } catch (err) {
    console.error("❌ rejectRepair error:", err);
    res.status(500).json({ message: "เกิดข้อผิดพลาดในการปฏิเสธงานซ่อม", error: err.message });
  }
};
