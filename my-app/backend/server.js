// backend/server.js
require('dotenv').config({ path: require('path').join(__dirname, '.envlocal') });

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

/* ========================= DB ========================= */
const db = require('./config/db');

/* ========================= Routes ========================= */
const authRoutes      = require('./routes/authRoutes');
const repairRoutes    = require('./routes/repairRoutes');
const roomRoutes      = require('./routes/roomRoutes');
const adminRoutes     = require('./routes/adminRoutes');
const paymentRoutes   = require('./routes/paymentRoutes');
const debtRoutes      = require('./routes/debtRoutes');
const adminProofs     = require('./routes/admin.paymentProofs');
const adminLineRoutes = require('./routes/admin.line');
const lineRoutes      = require('./routes/lineRoutes');
const reportsRouter   = require('./routes/reports.routes'); // ✅ ใช้ตัวนี้ตัวเดียว
const notifications   = require('./routes/notifications');
const dashboardRoutes = require('./routes/dashboardRoutes');

/* ========================= Middlewares ========================= */
const { verifyToken, authorizeRoles } = require('./middlewares/authMiddleware');
const paymentCtrl      = require('./controllers/paymentController');
const repairController = require('./controllers/repairController');

/* ========================= Global ========================= */
app.disable('x-powered-by');
app.use(
  cors({
    origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

/* ========================= LINE Webhook ========================= */
const LINE_WEBHOOK_PATH = process.env.LINE_WEBHOOK_PATH || '/webhooks/line';
app.use(LINE_WEBHOOK_PATH, express.raw({ type: '*/*' }), require('./routes/lineWebhook'));

/* ========================= Parsers/Static ========================= */
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

/* ========================= API ========================= */
app.get('/api', (_req, res) => {
  res.json({
    name: 'Dormitory API',
    version: process.env.npm_package_version || 'dev',
    time: new Date().toISOString(),
  });
});

// Public
app.use('/api/auth', authRoutes);
app.use('/api/line', lineRoutes);

// Protected (แต่ละ route group จัดการ auth ภายในไฟล์ route เองหรือก่อน mount ตามที่กำหนด)
app.use('/api/repairs', repairRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/notifications', notifications);

// Admin
app.use('/api/admin/proofs', adminProofs);
app.use('/api/admin/line', adminLineRoutes);
app.use('/api/admin/dashboard', dashboardRoutes);

// Reports — ให้ไฟล์ routes/reports.routes.js ดูแล verifyToken + authorizeRoles เอง
app.use('/api/reports', reportsRouter);

// Technicians
app.get(
  '/api/technicians',
  verifyToken,
  authorizeRoles('admin', 'staff'),
  repairController.listTechnicians
);

// Debts (admin only)
app.use('/api/debts', verifyToken, authorizeRoles('admin'), debtRoutes);

// Legacy
app.get('/api/invoices', verifyToken, paymentCtrl.getMyLastInvoices);

/* ========================= Errors ========================= */
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

/* ========================= Start ========================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
