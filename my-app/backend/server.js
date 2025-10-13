// backend/server.js
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

/* =========================
 * Route modules (CommonJS)
 * ========================= */
const authRoutes    = require('./routes/authRoutes');
const repairRoutes  = require('./routes/repairRoutes');
const roomRoutes    = require('./routes/roomRoutes');
const adminRoutes   = require('./routes/adminRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const debtRoutes    = require('./routes/debtRoutes.js');

// ❗️ไฟล์สามตัวด้านล่างต้อง export แบบ CommonJS:  module.exports = router
const adminProofs   = require('./routes/admin.paymentProofs');

/* =========================
 * Middlewares / Controllers
 * ========================= */
const { requireAuth } = require('./middlewares/auth');
const paymentCtrl     = require('./controllers/paymentController');

// 👉 ใช้สำหรับ alias /api/technicians (มี RBAC หลายบทบาท)
const { verifyToken, authorizeRoles } = require('./middlewares/authMiddleware');
const repairController = require('./controllers/repairController');

/* =========================
 * Global middlewares
 * ========================= */
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

/* =========================
 * Static: /uploads
 * ========================= */
const UPLOADS_DIR = path.resolve(__dirname, 'uploads'); // เปลี่ยนได้ตามโครงสร้างโปรเจกต์
app.use(
  '/uploads',
  express.static(UPLOADS_DIR, {
    fallthrough: true,
    immutable: true,
    maxAge: '7d',
  })
);

/* =========================
 * API routes
 * ========================= */
app.use('/api/auth',     authRoutes);
app.use('/api/repairs',  repairRoutes);
app.use('/api/rooms',    roomRoutes);
app.use('/api/admin',    adminRoutes);
app.use('/api/payments', paymentRoutes);

// ให้หน้า frontend เก่าที่เรียก /api/invoices ยังใช้ได้
app.get('/api/invoices', requireAuth, (req, res, next) =>
  paymentCtrl.getMyLastInvoices(req, res, next)
);

// ✅ Alias ตรงนี้: รายชื่อช่างสำหรับ dropdown (admin/staff)
app.get(
  '/api/technicians',
  verifyToken,
  authorizeRoles('admin', 'staff'),
  repairController.listTechnicians
);
app.get(
  '/api/tech/repairs',
  verifyToken,
  authorizeRoles('technician'),
  repairController.getAllRepairs
);

// อัปเดตสถานะโดย "ช่าง"
app.patch(
  '/api/tech/repairs/:id/status',
  verifyToken,
  authorizeRoles('technician'),
  repairController.techSetStatus
);

app.get(
  '/api/tech/repairs/:id',
  verifyToken,
  authorizeRoles('technician'),
  repairController.getRepairById
);

// ✅ ใช้ authorizeRoles('admin') แทน requireRole('admin')
app.use('/api/debts', verifyToken, authorizeRoles('admin'), debtRoutes);

// เส้นทางย่อยของแอดมิน (payment proofs)
app.use('/api/admin', adminProofs);

/* =========================
 * 404 (ไว้ท้ายสุดของ routes)
 * ========================= */
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.originalUrl,
    method: req.method,
  });
});

/* =========================
 * Error handler (ต้องมี 4 พารามิเตอร์)
 * ========================= */
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err && (err.stack || err.message || err));
  const status = err?.status || 500;
  const payload = {
    error: err?.message || 'Internal server error',
    code: err?.code || 'INTERNAL_ERROR',
  };
  if (process.env.NODE_ENV !== 'production') {
    payload.stack = err?.stack;
    payload.request = {
      method: req.method,
      url: req.originalUrl,
      headers: { 'content-type': req.headers['content-type'] },
      bodyType: typeof req.body,
    };
  }
  res.status(status).json(payload);
});

/* =========================
 * Start server
 * ========================= */
const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
