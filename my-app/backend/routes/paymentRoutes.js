// backend/routes/paymentRoutes.js
const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { verifyToken } = require('../middlewares/authMiddleware');
const paymentController = require('../controllers/paymentController');

const router = express.Router();

// เตรียมโฟลเดอร์อัปโหลดสลิป
const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'slips');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ts = Date.now();
    const safe = file.originalname.replace(/\s+/g, '_');
    cb(null, `${ts}_${safe}`);
  }
});
const upload = multer({ storage });

// ===== routes =====
router.get('/my-invoices', verifyToken, paymentController.getMyLastInvoices);
router.get('/qr', paymentController.getActiveQR);

// ชื่อฟิลด์ต้องเป็น 'slip'
router.post('/submit', verifyToken, upload.single('slip'), paymentController.submitPayment);

module.exports = router;
