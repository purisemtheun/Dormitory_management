require('dotenv').config({ path: require('path').join(__dirname, '.envlocal') });

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

/* =========================
 * DB connection
 * ========================= */
const db = require('./config/db');

/* =========================
 * Route modules
 * ========================= */
const authRoutes = require('./routes/authRoutes');
const repairRoutes = require('./routes/repairRoutes');
const roomRoutes = require('./routes/roomRoutes');
const adminRoutes = require('./routes/adminRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const debtRoutes = require('./routes/debtRoutes');
const adminProofs = require('./routes/admin.paymentProofs');
const adminLineRoutes = require('./routes/admin.line');
const lineRoutes = require('./routes/lineRoutes');
const reportRoutesFactory = require('./routes/report.routes');

/* =========================
 * Middlewares
 * ========================= */
const { verifyToken, authorizeRoles } = require('./middlewares/authMiddleware');
const paymentCtrl = require('./controllers/paymentController');
const repairController = require('./controllers/repairController');

/* =========================
 * Global middlewares
 * ========================= */
app.disable('x-powered-by');
app.use(cors({
  origin: ['http://localhost:3000','http://localhost:3001','http://localhost:3002'],
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  credentials: true,
}));

/* =========================
 * LINE Webhook
 * ========================= */
const LINE_WEBHOOK_PATH = process.env.LINE_WEBHOOK_PATH || '/webhooks/line';
app.use(
  LINE_WEBHOOK_PATH,
  express.raw({ type: '*/*' }),
  require('./routes/lineWebhook')
);

/* =========================
 * Body parsers
 * ========================= */
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

/* =========================
 * Static files
 * ========================= */
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

/* =========================
 * API routes
 * ========================= */
app.get('/api', (_req, res) => {
  res.json({
    name: 'Dormitory API',
    version: process.env.npm_package_version || 'dev',
    time: new Date().toISOString()
  });
});

// Public routes
app.use('/api/auth', authRoutes);
app.use('/api/line', lineRoutes);

// Protected routes
app.use('/api/repairs', repairRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/notifications', require('./routes/notifications'));

// Admin routes
app.use('/api/admin/proofs', adminProofs);
app.use('/api/admin/line', adminLineRoutes);
app.use('/api/admin/dashboard', require('./routes/dashboardRoutes'));

// Reports (requires auth + role)
const reportRoutes = reportRoutesFactory(db);
app.use('/api/reports', verifyToken, authorizeRoles('admin', 'staff'), reportRoutes);

// Technicians
app.get('/api/technicians', 
  verifyToken, 
  authorizeRoles('admin', 'staff'),
  repairController.listTechnicians
);

// Debts (admin only)
app.use('/api/debts', verifyToken, authorizeRoles('admin'), debtRoutes);

// Legacy routes
app.get('/api/invoices', verifyToken, paymentCtrl.getMyLastInvoices);

/* =========================
 * Error handlers
 * ========================= */
// 404
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.originalUrl
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    code: err.code || 'INTERNAL_ERROR'
  });
});

/* =========================
 * Start server
 * ========================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});