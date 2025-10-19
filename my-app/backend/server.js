// backend/server.js
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

/* =========================
 * Route modules
 * ========================= */
const authRoutes       = require('./routes/authRoutes');
const repairRoutes     = require('./routes/repairRoutes');
const roomRoutes       = require('./routes/roomRoutes');
const adminRoutes      = require('./routes/adminRoutes');
const paymentRoutes    = require('./routes/paymentRoutes');
const debtRoutes       = require('./routes/debtRoutes.js');
const adminProofs      = require('./routes/admin.paymentProofs');
const adminLineRoutes  = require('./routes/admin.line');

/* =========================
 * Middlewares / Controllers
 * ========================= */
const { requireAuth } = require('./middlewares/auth');
const paymentCtrl     = require('./controllers/paymentController');
const { verifyToken, authorizeRoles } = require('./middlewares/authMiddleware');
const repairController = require('./controllers/repairController');

/* =========================
 * Global middlewares (base)
 * ========================= */
app.disable('x-powered-by');
const corsOrigin = process.env.CORS_ORIGIN || true;
app.use(cors({ origin: corsOrigin, credentials: true }));

/* =====================================================
 * LINE Webhook — ต้องมาก่อน body parsers เสมอ
 * ===================================================== */
const LINE_WEBHOOK_PATH = process.env.LINE_WEBHOOK_PATH || '/webhooks/line';
const lineWebhook = require('./routes/lineWebhook');

// ✅ เปลี่ยนมาใช้ app.use เพื่อให้ path ถูก trim แล้วตรงกับ router.post('/') ภายในไฟล์ router
app.use(
  LINE_WEBHOOK_PATH,
  express.raw({ type: '*/*' }),
  lineWebhook
);

/* =========================
 * Body parsers (สำหรับ API อื่น)
 * ========================= */
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

/* =========================
 * Static: /uploads
 * ========================= */
const UPLOADS_DIR = path.resolve(__dirname, 'uploads');
app.use(
  '/uploads',
  express.static(UPLOADS_DIR, { fallthrough: true, immutable: true, maxAge: '7d' })
);

/* =========================
 * API routes
 * ========================= */
app.use('/api/auth',     authRoutes);
app.use('/api/repairs',  repairRoutes);
app.use('/api/rooms',    roomRoutes);
app.use('/api/admin',    adminRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin/dashboard', require('./routes/dashboardRoutes'));
app.use('/api', require('./routes/notifications'));

// เส้นทางย่อยของแอดมิน (payment proofs)
app.use('/api/admin', adminProofs);

// Admin LINE (ตั้งค่า/ทดสอบ)
app.use('/api', adminLineRoutes);

// Aliases / legacy
app.get('/api/invoices', requireAuth, (req, res, next) =>
  paymentCtrl.getMyLastInvoices(req, res, next)
);

// Technician helper routes
app.get('/api/technicians',
  verifyToken, authorizeRoles('admin', 'staff'),
  repairController.listTechnicians
);
app.get('/api/tech/repairs',
  verifyToken, authorizeRoles('technician'),
  repairController.getAllRepairs
);
app.patch('/api/tech/repairs/:id/status',
  verifyToken, authorizeRoles('technician'),
  repairController.techSetStatus
);
app.get('/api/tech/repairs/:id',
  verifyToken, authorizeRoles('technician'),
  repairController.getRepairById
);

// Debts (only admin)
app.use('/api/debts', verifyToken, authorizeRoles('admin'), debtRoutes);

/* =========================
 * 404
 * ========================= */
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.originalUrl,
    method: req.method,
  });
});

/* =========================
 * Error handler
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

app.get('/health', (_req, res) => res.status(200).send('ok'));

/* =========================
 * Start server
 * ========================= */
const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
