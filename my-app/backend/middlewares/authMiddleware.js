// middlewares/authMiddleware.js
const jwt = require('jsonwebtoken');

exports.verifyToken = (req, res, next) => {
  const auth = req.headers.authorization || '';
  if (!auth) return res.status(401).json({ error: 'Missing Authorization header', code: 'NO_AUTH' });

  const [scheme, token] = auth.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Bad auth scheme. Use: Bearer <token>', code: 'BAD_SCHEME' });
  }

  jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] }, (err, decoded) => {
    if (err) {
      const map = {
        TokenExpiredError: { code: 'TOKEN_EXPIRED', msg: 'Token expired' },
        JsonWebTokenError: { code: 'INVALID_TOKEN', msg: 'Invalid token' },
        NotBeforeError:    { code: 'TOKEN_NOT_ACTIVE', msg: 'Token not active' },
      };
      const { code, msg } = map[err.name] || { code: 'VERIFY_FAIL', msg: err.message };
      return res.status(401).json({ error: msg, code });
    }
    req.user = decoded; // { id, role, ... }
    next();
  });
};

exports.authorizeRoles = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden', code: 'ROLE_FORBIDDEN' });
  }
  next();
};
