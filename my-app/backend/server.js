// server.js
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// routes (ปรับ path ถ้าไฟล์อยู่ที่อื่น)
const authRoutes    = require('./routes/authRoutes');
const repairRoutes  = require('./routes/repairRoutes');
const roomRoutes    = require('./routes/roomRoutes');
const adminRoutes   = require('./routes/adminRoutes');
const paymentRoutes = require('./routes/paymentRoutes');

// middlewares
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// static uploads
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// --- DEBUG ROUTE (ชั่วคราว) ---
// ใส่ไว้ก่อน mount adminRoutes เพื่อทดสอบว่า request มาถึง server จริงหรือไม่
// ลบออกเมื่อ debug เสร็จ
app.all('/api/admin/invoices', express.json({ limit: '2mb' }), (req, res) => {
  console.log('==== DEBUG /api/admin/invoices ====');
  console.log('method:', req.method);
  console.log('url:', req.originalUrl);
  console.log('headers (partial):', {
    'content-type': req.headers['content-type'],
    // ถ้าต้องการ debug authorization ให้เปิดบรรทัดนี้ แต่ระวังข้อมูลลับ:
    // authorization: req.headers['authorization']
  });
  console.log('body type:', typeof req.body);
  try {
    console.log('body (preview):', JSON.stringify(req.body).slice(0, 200));
  } catch (e) {
    console.log('body (raw):', req.body);
  }
  // ส่งกลับข้อมูลเพื่อให้ client เห็นว่ามาถึงจริง
  return res.status(200).json({ debug: true, method: req.method, receivedType: typeof req.body, received: req.body });
});

// ไม่ต้องเช็ค token
app.use('/api/auth', authRoutes);

// เช็ค token/สิทธิ์ในแต่ละ route แล้ว (mount routers ของคุณ)
app.use('/api/repairs',  repairRoutes);
app.use('/api/rooms',    roomRoutes);
app.use('/api/admin',    adminRoutes);
app.use('/api/payments', paymentRoutes);

// 404 handler (วางหลัง route ทั้งหมด)
app.use((req, res, next) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.originalUrl,
    method: req.method
  });
});

// Global error handler (แสดง stack ใน dev เท่านั้น)
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
      headers: {
        'content-type': req.headers['content-type']
        // ระวัง: อย่าใส่ authorization หรือข้อมูลลับโดยไม่จำเป็น
      },
      bodyType: typeof req.body
    };
  }

  res.status(status).json(payload);
});

// start
const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
