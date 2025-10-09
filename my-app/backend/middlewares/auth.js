// backend/middlewares/auth.js
// Wrapper / compatibility layer เพื่อให้ require('../middlewares/auth') ใช้ได้
// และให้โค้ดเก่ายังเรียกชื่อคุ้นมืออย่าง requireAuth, requireAdmin, requireTenant ได้

const { verifyToken, authorizeRoles } = require('./authMiddleware');

// ใช้เป็นตัวกลางสำหรับ auth ทั่วไป
function requireAuth(req, res, next) {
  return verifyToken(req, res, next);
}

// ตัวช่วย compose middleware สองตัวแบบเป็น "ฟังก์ชันเดียว"
// เพื่อให้ router.use(requireAdmin) / router.use(requireTenant) ใช้ได้ชัวร์
function compose2(mw1, mw2) {
  return (req, res, next) => {
    mw1(req, res, (err) => {
      if (err) return next(err);
      mw2(req, res, next);
    });
  };
}

// ตรวจ role แบบกำหนดเอง (คงไว้ตามเดิม)
// NOTE: บางที่ใช้เป็น array ก็ได้ แต่เพื่อความนิ่ง ให้ใช้ compose2 ดีกว่า
function requireRole(...roles) {
  // คืนเป็น "อาเรย์" ตามสไตล์เดิม เพื่อไม่ทำลาย compatibility เดิมของคุณ
  return [verifyToken, authorizeRoles(...roles)];
}

// ====== เพิ่มสองตัวนี้ เพื่อแก้จุดที่พัง ======

// แอดมินเท่านั้น
const requireAdmin = compose2(
  verifyToken,
  authorizeRoles('admin')
);

// ผู้เช่าเท่านั้น + ต้องมี tenant_id
const requireTenant = (req, res, next) => {
  // ขั้นแรก verify token ก่อน
  verifyToken(req, res, (err) => {
    if (err) return next(err);
    // จากนั้นเช็ค role
    authorizeRoles('tenant')(req, res, (err2) => {
      if (err2) return next(err2);
      // เช็คเพิ่มว่า payload ต้องมี tenant_id
      if (!req.user || !req.user.tenant_id) {
        return res.status(400).json({ message: 'Missing tenant_id in token' });
      }
      return next();
    });
  });
};

// Export ให้ครบทั้งชื่อเก่าและชื่อใหม่ที่ใช้ในโปรเจกต์
module.exports = {
  requireAuth,
  requireRole,       // คงไว้เพื่อความเข้ากันได้
  verifyToken,
  authorizeRoles,
  requireAdmin,      // << ใช้ใน /api/admin/*
  requireTenant      // << ใช้ใน /api/tenant/*
};
