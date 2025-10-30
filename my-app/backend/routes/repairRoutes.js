// routes/repairs.routes.js
const express = require("express");
const router = express.Router();

const repair = require("../controllers/repairController");
const { verifyToken, authorizeRoles } = require("../middlewares/authMiddleware");

/* ======================================================
 * Base path: /api/repairs
 * ====================================================== */

/* ---------- Technicians (วางก่อน /:id) ---------- */
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

/* ---------- Create / Read (role จะถูกกรองใน controller) ---------- */
router.post(
  "/",
  verifyToken,
  authorizeRoles("tenant", "admin", "manager", "staff"),
  repair.createRepair
);

router.get("/", verifyToken, repair.getAllRepairs);

/* ---------- Technicians list for dropdown ---------- */
router.get(
  "/technicians",
  verifyToken,
  authorizeRoles("admin", "manager", "staff"),
  repair.listTechnicians
);

/* ---------- Assign / Admin status ---------- */
router.patch(
  "/:id/assign",
  verifyToken,
  authorizeRoles("admin", "manager", "staff"),
  repair.assignRepair
);

router.patch(
  "/:id/status",
  verifyToken,
  authorizeRoles("admin", "manager", "staff"),
  repair.adminSetStatus
);

/* ---------- Dynamic /:id (วางท้ายสุด) ---------- */
router.get("/:id", verifyToken, repair.getRepairById);

router.patch("/:id", verifyToken, repair.updateRepair);

/* ✅ Delete (เปิดใช้งานจริง) */
router.delete(
  "/:id",
  verifyToken,
  authorizeRoles("admin", "manager", "staff"),
  repair.deleteRepair
);

module.exports = router;
