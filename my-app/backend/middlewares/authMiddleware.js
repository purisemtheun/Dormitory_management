// middlewares/authMiddleware.js
const jwt = require('jsonwebtoken');

/** ดึง Bearer token จาก header Authorization (รองรับหลายค่า/มี quote/ตัวพิมพ์เล็กใหญ่) */
function extractBearerToken(authHeader = '') {
  return String(authHeader)
    .split(',')                 // เผื่อ proxy รวม header ซ้ำคั่นด้วย comma
    .map(s => s.trim())
    .reverse()                  // ใช้ตัวท้ายสุด
    .map(s => {
      const m = /^Bearer\s+(.+)$/i.exec(s);
      if (!m) return null;
      const tok = m[1].replace(/^"+|"+$/g, '').trim();
      return tok && tok.split('.').length === 3 ? tok : null; // JWT 3 ส่วน
    })
    .find(Boolean) || null;
}

/** ดึง token จากหลายช่องทาง */
function extractToken(req) {
  const fromAuth = extractBearerToken(req.headers?.authorization || req.headers?.Authorization);
  const fromX    = req.headers?.['x-access-token'] || req.headers?.['X-Access-Token'];
  const fromCookie = req.cookies?.token;
  const fromQuery  = req.query?.token;
  return fromAuth || fromX || fromCookie || fromQuery || null;
}

function verifyToken(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized', code: 'NO_TOKEN' });
  }
  try {
    // ถ้าใช้ HS256 ก็โอเค ไม่ต้อง fix algorithms
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // เผื่อ payload ห่ออยู่ใน field user จากระบบเดิม
    req.user = payload?.user ? payload.user : payload;
    return next();
  } catch (err) {
    const codeMap = {
      TokenExpiredError: 'TOKEN_EXPIRED',
      JsonWebTokenError: 'INVALID_TOKEN',
      NotBeforeError: 'TOKEN_NOT_ACTIVE',
    };
    return res.status(401).json({ error: err.message, code: codeMap[err.name] || 'VERIFY_FAIL' });
  }
}

function authorizeRoles(...roles) {
  return (req, res, next) => {
    const role = req.user?.role;
    if (!role || !roles.includes(role)) {
      return res.status(403).json({ error: 'Forbidden', code: 'ROLE_FORBIDDEN' });
    }
    next();
  };
}

module.exports = { verifyToken, authorizeRoles };
