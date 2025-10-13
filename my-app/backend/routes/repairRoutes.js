// backend/routes/repairRoutes.js
const express = require("express");
const router = express.Router();

const repair = require("../controllers/repairController");
const { verifyToken, authorizeRoles } = require("../middlewares/authMiddleware");

/* ======================================================
 * 🧱 ROUTES: /api/repairs  (server.js mount แล้ว)
 * ====================================================== */

/** ✅ 1. Tenant / Admin สร้างใบแจ้งซ่อม */
router.post(
  "/",
  verifyToken,
  authorizeRoles("tenant", "admin", "manager"),
  repair.createRepair
);

/** ✅ 2. ดึงรายการแจ้งซ่อมทั้งหมด (filter ตาม role อัตโนมัติ) */
router.get("/", verifyToken, repair.getAllRepairs);

/** ✅ 3. ดึงรายละเอียดงานซ่อมทีละรายการ */
router.get("/:id", verifyToken, repair.getRepairById);

/** ✅ 4. แก้ไขข้อมูลงานซ่อม (เช่น เปลี่ยนรายละเอียด / รูป) */
router.patch("/:id", verifyToken, repair.updateRepair);

/** ✅ 5. ลบงานซ่อม (เฉพาะ admin) */
router.delete(
  "/:id",
  verifyToken,
  authorizeRoles("admin"),
  repair.deleteRepair
);

/** ✅ 6. มอบหมายงานให้ช่าง (Admin / Manager เท่านั้น) */
router.patch(
  "/:id/assign",
  verifyToken,
  authorizeRoles("admin", "manager"),
  repair.assignRepair
);

/** ✅ 7. รายชื่อช่าง (ใช้ใน dropdown ฝั่งแอดมิน) */
router.get(
  "/technicians",
  verifyToken,
  authorizeRoles("admin", "manager", "staff"),
  repair.listTechnicians
);

/* ======================================================
 * 🔧 ROUTES: /api/tech/repairs (alias สำหรับช่าง)
 * ====================================================== */

/** ✅ 8. รายการงานของช่าง (เฉพาะ assigned_to = user.id) */
router.get(
  "/tech",
  verifyToken,
  authorizeRoles("technician"),
  repair.getAllRepairs
);

/** ✅ 9. รายละเอียดงานของช่างทีละงาน */
router.get(
  "/tech/:id",
  verifyToken,
  authorizeRoles("technician"),
  repair.getRepairById
);

/** ✅ 10. ช่างอัปเดตสถานะงาน (เริ่ม / เสร็จสิ้น) */
router.patch(
  "/tech/:id/status",
  verifyToken,
  authorizeRoles("technician"),
  repair.techSetStatus
);

module.exports = router;
