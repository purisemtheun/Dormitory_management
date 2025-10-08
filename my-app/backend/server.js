require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// routes
const authRoutes    = require('./routes/authRoutes');
const repairRoutes  = require('./routes/repairRoutes');
const roomRoutes    = require('./routes/roomRoutes');
const adminRoutes   = require('./routes/adminRoutes');
const paymentRoutes = require('./routes/paymentRoutes');

// เพิ่มแค่สองบรรทัดนี้เพื่อทำ alias /api/invoices
const { requireAuth } = require('./middlewares/auth');
const paymentCtrl = require('./controllers/paymentController');

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));


app.use(
  "/uploads",
  require("express").static(path.join(__dirname, "..", "uploads"), {
    fallthrough: true, immutable: true, maxAge: "7d",
  })
);


// === DEBUG (ลบได้เมื่อไม่ใช้) ===
// app.all('/api/admin/invoices', express.json({ limit: '2mb' }), (req, res) => {
//   console.log('==== DEBUG /api/admin/invoices ====');
//   console.log('method:', req.method);
//   console.log('url:', req.originalUrl);
//   console.log('headers (partial):', { 'content-type': req.headers['content-type'] });
//   try { console.log('body (preview):', JSON.stringify(req.body).slice(0, 200)); }
//   catch (e) { console.log('body (raw):', req.body); }
//   return res.status(200).json({ debug: true, method: req.method, receivedType: typeof req.body, received: req.body });
// });

app.use('/api/auth',   authRoutes);
app.use('/api/repairs', repairRoutes);
app.use('/api/rooms',   roomRoutes);
app.use('/api/admin',   adminRoutes);
app.use('/api/payments', paymentRoutes);

// ---------- เพิ่ม alias ให้เส้นเดิมที่หน้าบ้านเรียก ----------
app.get('/api/invoices', requireAuth, (req, res, next) => {
  return paymentCtrl.getMyLastInvoices(req, res, next);
});
// -------------------------------------------------------------

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.originalUrl,
    method: req.method
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err && (err.stack || err.message || err));
  const status = (err && err.status) ? err.status : 500;
  const payload = {
    error: (err && err.message) ? err.message : 'Internal server error',
    code: (err && err.code) ? err.code : 'INTERNAL_ERROR'
  };
  if (process.env.NODE_ENV !== 'production') {
    payload.stack = err && err.stack ? err.stack : undefined;
    payload.request = {
      method: req.method,
      url: req.originalUrl,
      headers: { 'content-type': req.headers['content-type'] },
      bodyType: typeof req.body
    };
  }
  res.status(status).json(payload);
});

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
