// controllers/authController.js
const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const ALLOWED_ROLES = new Set(['admin', 'tenant', 'technician']);
const normalizeRole = r => (ALLOWED_ROLES.has(r) ? r : 'tenant');

function signUserToken({ id, role }) {
  const payload = { id, sub: id, role };
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '1d',
  });
}

// POST /api/auth/register  -> สมัครพร้อมเลือกบทบาท
exports.register = async (req, res) => {
  try {
    const { name, email, password, phone, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email, password จำเป็นต้องมี' });
    }
    const roleFinal = normalizeRole(role);

    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) return res.status(409).json({ error: 'Email already exists' });

    const hashed = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO users (name, email, password, role, phone) VALUES (?, ?, ?, ?, ?)',
      [name, email, hashed, roleFinal, phone || null]
    );

    const userId = result.insertId;
    const token = signUserToken({ id: userId, role: roleFinal });

    return res.status(201).json({
      message: 'Register success',
      token,
      user: { id: userId, name, email, role: roleFinal, phone: phone || null },
    });
  } catch (err) {
    console.error('🔥 Register error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
};

// POST /api/auth/login  -> เข้าสู่ระบบด้วยอีเมล
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email และ password จำเป็นต้องมี' });
    }

    const [rows] = await db.query(
      'SELECT id, name, email, password, role, phone FROM users WHERE email = ?',
      [email]
    );
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    // ✅ รองรับทั้งรหัสที่เป็น bcrypt และ plaintext เดิม
    let ok;
    if (user.password && user.password.startsWith('$2')) {
      ok = await bcrypt.compare(password, user.password);  // bcrypt
    } else {
      ok = (password === user.password);                   // plaintext เก่า
    }
    if (!ok) return res.status(401).json({ error: 'Invalid email or password' });

    const token = signUserToken({ id: user.id, role: user.role });

    return res.status(200).json({
      message: 'Login success',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
      },
    });
  } catch (err) {
    console.error('🔥 Login error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
};
