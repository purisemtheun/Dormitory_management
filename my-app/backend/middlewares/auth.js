// backend/middlewares/auth.js
// Wrapper / compatibility layer เพื่อให้ require('../middlewares/auth') ใช้ได้

const { verifyToken, authorizeRoles } = require('./authMiddleware');

// ในโค้ดเก่าบางไฟล์อาจเรียกชื่อ requireAuth หรือ require
// ให้สร้างตัวเลือกชื่อที่มักถูกใช้ไว้ทั้งคู่:
function requireAuth(req, res, next) {
  return verifyToken(req, res, next);
}

// ถ้าต้องการตรวจ role แบบง่าย:
function requireRole(...roles) {
  return [
    verifyToken,
    authorizeRoles(...roles)
  ];
}

// Export ทั้งแบบเดี่ยวและแบบกลุ่ม (รองรับทั้งรูปแบบ require('./middlewares/auth').requireAuth
module.exports = {
  requireAuth,
  requireRole,
  verifyToken,
  authorizeRoles
};
