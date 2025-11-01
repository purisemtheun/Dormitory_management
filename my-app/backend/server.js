// backend/server.js
const path = require('path');
const express = require('express');
const cors = require('cors');

/* ==================== Load env ==================== */
// โหลดจาก .envlocal เฉพาะตอน dev; บน Render จะฉีด env มาเอง
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({ path: path.join(__dirname, '.envlocal') });
}

const app = express();

/* ==================== DB connect ==================== */
require('./config/db'); // แค่ require เพื่อเปิดคอนเนคชัน

/* ==================== Middlewares ==================== */
const { verifyToken, authorizeRoles } = require('./middlewares/authMiddleware');
const paymentCtrl      = require('./controllers/paymentController');
const repairController = require('./controllers/repairController');

app.disable('x-powered-by');

// อนุญาต CORS เฉพาะ origin ที่กำหนด (รวมเว็บบน Render)
const ALLOWED = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'https://dormitory-management-t3k2.onrender.com',
];
app.use(
  cors({
    origin: (origin, cb) => cb(null, !origin || ALLOWED.includes(origin)),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

// Parsers
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Static uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

/* ==================== API Routes ==================== */
// Health
app.get('/api', (_req, res) => {
  res.json({
    name: 'Dormitory API',
    version: process.env.npm_package_version || 'dev',
    time: new Date().toISOString(),
  });
});

// Public
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/line', require('./routes/lineRoutes'));

// Protected groups
app.use('/api/repairs', require('./routes/repairRoutes'));
app.use('/api/rooms', require('./routes/roomRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/notifications', require('./routes/notifications'));

// Admin dashboards
app.use('/api/admin/proofs', require('./routes/admin.paymentProofs'));
app.use('/api/admin/line', require('./routes/admin.line'));
app.use('/api/admin/dashboard', require('./routes/dashboardRoutes'));

// Reports
app.use('/api/reports', require('./routes/reports.routes'));

// Technicians
app.get(
  '/api/technicians',
  verifyToken,
  authorizeRoles('admin', 'staff'),
  repairController.listTechnicians
);

// Debts (admin only)
app.use('/api/debts', verifyToken, authorizeRoles('admin'), require('./routes/debtRoutes'));

// Legacy
app.get('/api/invoices', verifyToken, paymentCtrl.getMyLastInvoices);

/* ==================== Serve React build ==================== */
const CLIENT_BUILD = path.join(__dirname, 'build');
app.use(express.static(CLIENT_BUILD));

// เดิม: app.get('*', ...)  <-- ทำให้ error บน Express v5
// ใหม่: ใช้ RegExp และกัน /api ออกด้วย negative lookahead
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(CLIENT_BUILD, 'index.html'));
});

/* ==================== Errors ==================== */
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found', path: req.originalUrl });
});
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    code: err.code || 'INTERNAL_ERROR',
  });
});

/* ==================== Start ==================== */
const PORT = process.env.PORT || 3000; // Render จะกำหนด PORT เอง
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
