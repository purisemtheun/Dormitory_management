// backend/routes/repairRoutes.js
const express = require("express");
const router = express.Router();

const repair = require("../controllers/repairController");
const admin = require("../controllers/adminRepairController"); // ถ้ามี
const tech = require("../controllers/techRepairController");   // ถ้ามี

const { verifyToken, authorizeRoles } = require("../middlewares/authMiddleware");

/* ======================================================
 * /api/repairs
 * ====================================================== */

// สร้างใบแจ้งซ่อม
router.post(
  "/",
  verifyToken,
  authorizeRoles("tenant", "admin", "manager"),
  repair.createRepair
);

// ดึงรายการทั้งหมด (กรองตาม role)
router.get("/", verifyToken, repair.getAllRepairs);

// รายการทีละงาน
router.get("/:id", verifyToken, repair.getRepairById);

// แก้ไขงาน
router.patch("/:id", verifyToken, repair.updateRepair);

// ลบงาน (admin)
router.delete(
  "/:id",
  verifyToken,
  authorizeRoles("admin"),
  repair.deleteRepair
);

// รายชื่อช่างสำหรับ dropdown
router.get(
  "/technicians",
  verifyToken,
  authorizeRoles("admin", "manager", "staff"),
  repair.listTechnicians
);

/* ---------- สำคัญ: ให้ตรงกับ Frontend ---------- */
// มอบหมายงานให้ช่าง (เรียกจาก FE: PATCH /api/repairs/:id/assign)
router.patch(
  "/:id/assign",
  verifyToken,
  authorizeRoles("admin", "manager"),
  repair.assignRepair
);

// แอดมินเปลี่ยนสถานะ (ใช้ปุ่ม "ปฏิเสธ")
router.patch(
  "/:id/status",
  verifyToken,
  authorizeRoles("admin", "manager"),
  repair.adminSetStatus
);

/* ======================================================
 * ส่วนของช่าง (ถ้ามีเรียกใช้งาน)
 * ====================================================== */
router.get(
  "/tech",
  verifyToken,
  authorizeRoles("technician"),
  repair.getAllRepairs
);

router.get(
  "/tech/:id",
  verifyToken,
  authorizeRoles("technician"),
  repair.getRepairById
);

router.patch(
  "/tech/:id/status",
  verifyToken,
  authorizeRoles("technician"),
  repair.techSetStatus
);

module.exports = router;
