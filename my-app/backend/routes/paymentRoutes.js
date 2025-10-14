// routes/paymentRoutes.js
const express = require('express');
const path = require('path');
const multer = require('multer');
const paymentCtrl = require('../controllers/paymentController');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();

// ตั้ง storage สำหรับสลิป (uploads/slips)
const uploadDir = path.join(__dirname, '..', 'uploads', 'slips');
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const name = Date.now() + '-' + file.originalname.replace(/\s+/g, '_');
    cb(null, name);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// GET /api/payments/my-invoices
router.get('/my-invoices', requireAuth, paymentCtrl.getMyLastInvoices);

// GET /api/payments/qr (public)
router.get('/qr', paymentCtrl.getActiveQR);

// POST /api/payments/submit (multipart) - ต้อง login
router.post('/submit', requireAuth, upload.single('slip'), paymentCtrl.submitPayment);

router.post('/approve', requireAuth, paymentCtrl.approvePayment);
router.post('/reject',  requireAuth, paymentCtrl.rejectPayment);

module.exports = router;
