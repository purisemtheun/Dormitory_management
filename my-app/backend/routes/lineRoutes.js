const express = require("express");
const router = express.Router();
const { verifyToken, authorizeRoles } = require("../middlewares/auth"); // ปรับ path ตามโปรเจกต์
const ctrl = require("../controllers/lineController");

// สถานะผูก (ทุกผู้ใช้ที่ล็อกอินได้)
router.get("/status", verifyToken, ctrl.getLineStatus);

// ขอรหัสลิงก์ (จำกัด role ปกติ: tenant) — ระหว่างทดสอบจะคลายเป็น tenant|admin ก็ได้
router.post(
  "/link-token",
  verifyToken,
  authorizeRoles("tenant"), // ชั่วคราว: authorizeRoles("tenant","admin","staff")
  ctrl.postLinkToken
);

module.exports = router;
