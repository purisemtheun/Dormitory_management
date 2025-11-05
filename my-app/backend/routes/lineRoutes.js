// backend/routes/lineRoutes.js
const express = require("express");
const router = express.Router();

const { verifyToken, authorizeRoles } = require("../middlewares/authMiddleware");
const { ensureLineTables, getLineStatus, postLinkToken } = require("../controllers/lineController");

// สร้างตารางให้พร้อมใช้งานทุกครั้งแบบเงียบ ๆ
router.use(async (_req, _res, next) => { await ensureLineTables().catch(()=>{}); next(); });

// สถานะการผูกบัญชี (ผู้ใช้ที่ล็อกอินแล้ว)
router.get("/status", verifyToken, getLineStatus);

// ขอรหัสสำหรับผูก (ตามจริงควรจำกัดเฉพาะ tenant)
// ระหว่างทดสอบถ้าจำเป็น เปลี่ยนเป็น authorizeRoles("tenant","admin","staff")
router.post("/link-token", verifyToken, authorizeRoles("tenant"), postLinkToken);

module.exports = router;
