// middlewares/authMiddleware.js
const jwt = require('jsonwebtoken');

/** ดึง Bearer token จาก header (รองรับหลายค่า/มี quote/ตัวพิมพ์เล็กใหญ่ต่างกัน) */
function extractBearerToken(authHeader = '') {
  return authHeader
    .split(',')
    .map(s => s.trim())
    .reverse()
    .map(s => {
      const m = /^Bearer\s+(.+)$/i.exec(s);      // i = ไม่แคร์พิมพ์เล็กใหญ่
      if (!m) return null;
      const tok = m[1].replace(/^"+|"+$/g, '').trim();
      return tok && tok.split('.').length === 3 ? tok : null; // โครง JWT 3 ส่วน
    })
    .find(Boolean) || null;
}

function verifyToken(req, res, next) {
  const token = extractBearerToken(req.headers.authorization);
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized', code: 'NO_TOKEN' });
  }
  try {
    // ถ้าแน่ใจว่า sign ด้วย HS256 เสมอคงค่า algorithms ได้
    // แต่ถ้าไม่แน่ใจ ให้ลบ options ออก เพื่อไม่ให้ verify ล้มเพราะ alg ไม่ตรง
    // const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { id, role, ... }
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
    const role = req.user && req.user.role;
    if (!role || !roles.includes(role)) {
      return res.status(403).json({ error: 'Forbidden', code: 'ROLE_FORBIDDEN' });
    }
    next();
  };
}

// ✅ export แบบชัดเจน เพื่อเลี่ยงปัญหาบางกรณีของ exports / module.exports
module.exports = { verifyToken, authorizeRoles };
