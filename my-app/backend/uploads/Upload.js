// backend/middlewares/upload.js
const path = require('path');
const fs = require('fs');
const multer = require('multer');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/**
 * สร้าง uploader ใช้ซ้ำได้
 * คืน { upload, toPublicUrl, dir }
 */
function createUploader({ subdir, maxMB = 5, mimes = ['image/png', 'image/jpeg'] }) {
  const dir = path.join(__dirname, '..', 'uploads', subdir);
  ensureDir(dir);

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase();
      const name = `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
      cb(null, name);
    },
  });

  const fileFilter = (_req, file, cb) => {
    const ok = mimes.some((m) => {
      if (m.endsWith('/*')) return file.mimetype.startsWith(m.replace('/*', '/'));
      return file.mimetype === m;
    });
    cb(ok ? null : new Error('Invalid file type'), ok);
  };

  const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: maxMB * 1024 * 1024 },
  });

  const toPublicUrl = (filename) => `/uploads/${subdir}/${filename}`;
  return { upload, toPublicUrl, dir };
}

// พรีเซ็ตพร้อมใช้ (เผื่อที่อื่นเรียก)
const slipUpload = createUploader({
  subdir: 'slips',
  maxMB: 5,
  mimes: ['image/png', 'image/jpeg', 'application/pdf'],
});

const repairUpload = createUploader({
  subdir: 'repairs',
  maxMB: 8,
  mimes: ['image/*'],
});

module.exports = { createUploader, slipUpload, repairUpload };
