// backend/routes/roomroutes.js
const router = require("express").Router();
const roomController = require("../controllers/roomController");
const roomReservationController = require("../controllers/roomReservationController"); // ✅ NEW: แยก controller จองห้อง
const { verifyToken, authorizeRoles } = require("../middlewares/authMiddleware");

/* ======================== Tenant ======================== */
// ห้องของผู้ใช้คนปัจจุบัน
router.get("/mine", verifyToken, roomController.getMyRoom);

// ผังสถานะห้องทั้งหมด (ให้ tenant เห็นได้)
router.get("/board", verifyToken, roomController.getRoomBoard);

/* ================== Admin / Staff / Manager ================== */
// จัดการรายการห้อง
router.get("/", verifyToken, authorizeRoles("admin", "staff"), roomController.listRooms);
router.post("/", verifyToken, authorizeRoles("admin", "staff"), roomController.createRoom);
router.patch("/:id", verifyToken, authorizeRoles("admin", "staff"), roomController.updateRoom);
router.delete("/:id", verifyToken, authorizeRoles("admin", "staff"), roomController.deleteRoom);

// (เดิม) จองห้องให้ผู้เช่าโดยแอดมิน/สตาฟ
router.post("/:id/book", verifyToken, authorizeRoles("admin", "staff"), roomController.bookRoomForTenant);

/* ================== NEW: Reservations Approval ================== */
// ✅ ดึง “คำขอจองห้อง” (ค่าเริ่มต้น: pending)
router.get(
  "/reservations",
  verifyToken,
  authorizeRoles("admin", "manager", "staff"),
  roomReservationController.listReservationsPending
);

// ✅ ตัดสิน “อนุมัติ/ปฏิเสธ” คำขอจอง
router.patch(
  "/reservations/:id/decision",
  verifyToken,
  authorizeRoles("admin", "manager", "staff"),
  roomReservationController.decideReservation
);

router.post(
  "/:roomId/reservations",
  verifyToken,              // ถ้าระบบคุณมี role "tenant" และอยากบังคับก็ใช้ authorizeRoles('tenant')
  // authorizeRoles("tenant"),
  roomReservationController.createReservation
);

module.exports = router;
