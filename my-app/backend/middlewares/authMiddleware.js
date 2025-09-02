// middlewares/authMiddleware.js
const jwt = require('jsonwebtoken');

// ดึง Bearer token ให้ทนเคส "Bearer a, Bearer b" และมี " ครอบ
function extractBearerToken(authHeader = '') {
  const parts = authHeader.split(',').map(s => s.trim());
  for (let i = parts.length - 1; i >= 0; i--) {
    const m = /^Bearer\s+(.+)$/.exec(parts[i]);
    if (!m) continue;
    const token = m[1].replace(/^"+|"+$/g, '').trim();
    if (token.split('.').length === 3) return token; // รูปแบบ JWT 3 ส่วน
  }
  return null;
}

exports.verifyToken = (req, res, next) => {
  const token = extractBearerToken(req.headers.authorization);
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized', code: 'NO_TOKEN' });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    return next();
  } catch (err) {
    const codeMap = {
      TokenExpiredError: 'TOKEN_EXPIRED',
      JsonWebTokenError: 'INVALID_TOKEN',
      NotBeforeError: 'TOKEN_NOT_ACTIVE',
    };
    return res.status(401).json({ error: err.message, code: codeMap[err.name] || 'VERIFY_FAIL' });
  }
};

exports.authorizeRoles = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden', code: 'ROLE_FORBIDDEN' });
  }
  next();
};
