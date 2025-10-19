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

/* ---------- กลุ่ม "ช่าง" ต้องวางก่อน dynamic /:id ---------- */
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

/* ---------- สร้าง/อ่านรวม ---------- */
// สร้างใบแจ้งซ่อม
router.post(
  "/",
  verifyToken,
  authorizeRoles("tenant", "admin", "manager"),
  repair.createRepair
);

// ดึงรายการทั้งหมด (ระบบจะกรองตาม role ภายใน controller)
router.get("/", verifyToken, repair.getAllRepairs);

/* ---------- รายชื่อช่างสำหรับ dropdown ---------- */
router.get(
  "/technicians",
  verifyToken,
  authorizeRoles("admin", "manager", "staff"),
  repair.listTechnicians
);

/* ---------- มอบหมาย/เปลี่ยนสถานะ (ฝั่งแอดมิน) ---------- */
// มอบหมายงานให้ช่าง
router.patch(
  "/:id/assign",
  verifyToken,
  authorizeRoles("admin", "manager"),
  repair.assignRepair
);

// แอดมินเปลี่ยนสถานะ (เช่น ปฏิเสธ)
router.patch(
  "/:id/status",
  verifyToken,
  authorizeRoles("admin", "manager"),
  repair.adminSetStatus
);

/* ---------- เส้นทาง dynamic /:id วางท้ายสุด ---------- */
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

module.exports = router;
