// backend/controllers/techRepairController.js
const db = require("../config/db");
const STATUS = require("./repairStatus");

/* ======================================================
 * 👷 ช่าง: ดูงานของตัวเอง (ASSIGNED + IN_PROGRESS)
 * ====================================================== */
exports.myOpenRepairs = async (req, res) => {
  try {
    const techId = req.user.id;

    const [rows] = await db.query(
      `SELECT r.*, 
              rm.room_no, 
              u.fullname AS tenant_name
       FROM repairs r
       LEFT JOIN rooms rm ON rm.id = r.room_id
       LEFT JOIN users u ON u.id = r.tenant_id
       WHERE r.assigned_technician_id = ?
         AND r.status IN (?, ?)
       ORDER BY r.updated_at DESC`,
      [techId, STATUS.ASSIGNED, STATUS.IN_PROGRESS]
    );

    res.json(rows);
  } catch (err) {
    console.error("❌ myOpenRepairs error:", err);
    res.status(500).json({ message: "ไม่สามารถดึงงานของช่างได้", error: err.message });
  }
};

/* ======================================================
 * 🟨 ช่าง: เริ่มทำงาน
 * ====================================================== */
exports.startRepair = async (req, res) => {
  try {
    const techId = req.user.id;
    const { id } = req.params;

    const [chk] = await db.query(
      "SELECT * FROM repairs WHERE id = ? AND assigned_technician_id = ?",
      [id, techId]
    );

    if (!chk.length) return res.status(403).json({ message: "ไม่มีสิทธิ์ในงานนี้" });
    if (chk[0].status !== STATUS.ASSIGNED)
      return res.status(400).json({ message: "งานนี้เริ่มไปแล้วหรือไม่สามารถเริ่มได้" });

    await db.query(
      `UPDATE repairs
       SET status = ?, started_at = NOW(), updated_at = NOW()
       WHERE id = ?`,
      [STATUS.IN_PROGRESS, id]
    );

    res.json({ message: "เริ่มงานซ่อมเรียบร้อย" });
  } catch (err) {
    console.error("❌ startRepair error:", err);
    res.status(500).json({ message: "ไม่สามารถเริ่มงานได้", error: err.message });
  }
};

/* ======================================================
 * 🟩 ช่าง: เสร็จสิ้นงาน
 * ====================================================== */
exports.completeRepair = async (req, res) => {
  try {
    const techId = req.user.id;
    const { id } = req.params;

    const [chk] = await db.query(
      "SELECT * FROM repairs WHERE id = ? AND assigned_technician_id = ?",
      [id, techId]
    );

    if (!chk.length) return res.status(403).json({ message: "ไม่มีสิทธิ์ในงานนี้" });
    if (chk[0].status !== STATUS.IN_PROGRESS)
      return res.status(400).json({ message: "ไม่สามารถเสร็จสิ้นงานนี้ได้" });

    await db.query(
      `UPDATE repairs
       SET status = ?, completed_at = NOW(), updated_at = NOW()
       WHERE id = ?`,
      [STATUS.DONE, id]
    );

    res.json({ message: "เสร็จสิ้นงานซ่อมเรียบร้อย" });
  } catch (err) {
    console.error("❌ completeRepair error:", err);
    res.status(500).json({ message: "ไม่สามารถอัปเดตงานเสร็จสิ้นได้", error: err.message });
  }
};
