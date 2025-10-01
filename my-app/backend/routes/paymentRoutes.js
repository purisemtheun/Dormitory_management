// backend/routes/paymentRoutes.js
const router = require('express').Router();
const { verifyToken } = require('../middlewares/authMiddleware');
const paymentController = require('../controllers/paymentController');

// ===== Robust import for upload module (รองรับทั้ง 2 รูปแบบ export) =====
const uploadMod = require('../middlewares/upload'); // << ชื่อไฟล์ต้องเป็น upload.js ตัวเล็ก
// พิมพ์ดูคีย์เพื่อ debug เวลาเริ่มเซิร์ฟเวอร์
console.log('upload module type:', typeof uploadMod, 'keys:', uploadMod && Object.keys(uploadMod || {}));

// รองรับ 3 รูปแบบ export:
// 1) module.exports = { createUploader, slipUpload, ... }
// 2) module.exports = createUploader (default เป็นฟังก์ชัน)
// 3) module.exports = multerInstance (กรณี export เป็น uploader ตรง ๆ)
const createUploader =
  (uploadMod && uploadMod.createUploader) // แบบอ็อบเจ็กต์
  || (typeof uploadMod === 'function' ? uploadMod : null); // แบบ default function

let slipUpload;
if (createUploader) {
  // สร้าง uploader สำหรับสลิป
  slipUpload = createUploader({
    subdir: 'slips',
    maxMB: 5,
    mimes: ['image/png', 'image/jpeg', 'application/pdf'],
  });
} else if (uploadMod && typeof uploadMod.single === 'function') {
  // กรณี export เป็น multer instance ตรง ๆ (ไม่ใช่ factory)
  slipUpload = { upload: uploadMod }; // ให้มี .upload.single(...) ใช้ได้
} else {
  throw new Error('✗ upload module ไม่มี createUploader หรือ multer instance');
}

// ================== routes ==================
router.get('/my-invoices', verifyToken, paymentController.getMyLastInvoices);
router.get('/qr', paymentController.getActiveQR);

router.post(
  '/submit',
  verifyToken,
  slipUpload.upload.single('slip'), // ← ใช้ได้ทั้งสองกรณี
  paymentController.submitPayment
);

module.exports = router;
