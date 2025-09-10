// backend/middlewares/repairUpload.js
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const ROOT = path.join(__dirname, '..', '..', 'uploads', 'repairs');
if (!fs.existsSync(ROOT)) fs.mkdirSync(ROOT, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, ROOT),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = `${Date.now()}-${Math.random().toString(36).slice(2,8)}${ext}`;
    cb(null, name);
  },
});

const fileFilter = (_req, file, cb) => {
  if (!/^image\//.test(file.mimetype)) return cb(new Error('เฉพาะไฟล์รูปภาพเท่านั้น'));
  cb(null, true);
};

module.exports = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });
