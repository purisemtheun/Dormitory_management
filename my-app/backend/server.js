// server.js
require('dotenv').config();
const express = require('express');
const app = express();

const authRoutes   = require('./routes/authRoutes');
const repairRoutes = require('./routes/repairRoutes');
const roomRoutes   = require('./routes/roomRoutes');

app.use(express.json());

// ไม่ต้องเช็ค token
app.use('/api/auth', authRoutes);

// เช็ค token/สิทธิ์ภายในไฟล์ route แต่ละอัน
app.use('/api/repairs', repairRoutes);
app.use('/api/rooms',   roomRoutes);

// 404
app.use((req, res) => res.status(404).json({ error: 'Not Found' }));

// Global error handler (แบบย่อ)
app.use((err, req, res, next) => {
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
