// backend/server.js
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// routes
const authRoutes   = require('./routes/authRoutes');
const repairRoutes = require('./routes/repairRoutes');
const roomRoutes   = require('./routes/roomRoutes');

// middlewares
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));

// ให้โหลดไฟล์รูปที่อัปโหลดได้ (ถ้าใช้โฟลเดอร์ uploads/)
app.use('/uploads', express.static(path.join(__dirname,'..', 'uploads')));

// ไม่ต้องเช็ค token
app.use('/api/auth', authRoutes);

// เช็ค token/สิทธิ์อยู่ในไฟล์ route แต่ละอันแล้ว
app.use('/api/repairs', repairRoutes);
app.use('/api/rooms',   roomRoutes);
// ❌ ลบบรรทัดนี้ออก ไม่ต้องใช้ app.use('/api', repairRoutes);

// 404
app.use((req, res) => res.status(404).json({ error: 'Not Found' }));

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    code: err.code || 'INTERNAL_ERROR',
  });
});

// ตั้งค่า CORS ซ้ำ ไม่จำเป็น ให้ลบออก หรือใช้แค่ครั้งเดียวก็พอ
// app.use(cors({
//   origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
//   methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
//   allowedHeaders: ["Content-Type", "Authorization"],
// }));
// app.options("*", cors());

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));