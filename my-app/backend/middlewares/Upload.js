// backend/middlewares/upload.js
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const mime = require('mime-types');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/**
 * สร้าง uploader ใช้ซ้ำได้
 * คืน { upload, toPublicUrl, dir }
 *
 * NOTE:
 * - รองรับทั้ง MIME และนามสกุลไฟล์ (.jpg/.jpeg/.png/.pdf)
 * - ครอบคลุมกรณีบางเบราว์เซอร์ส่ง image/jpg
 * - ถ้าไม่มีนามสกุลหรือไม่แมตช์ ให้เดาจาก mimetype ด้วย mime-types
 */
function createUploader({ subdir, maxMB = 5, mimes = ['image/png', 'image/jpeg'] }) {
  const dir = path.join(__dirname, '..', 'uploads', subdir);
  ensureDir(dir);

  // สร้างชุด MIME/EXT ที่อนุญาต
  // เติม image/jpg อัตโนมัติถ้าระบุ image/jpeg เข้ามา
  const mimeSet = new Set(mimes);
  if (mimeSet.has('image/jpeg')) mimeSet.add('image/jpg');

  // map mime -> allowed extensions
  const extAllow = new Set();
  for (const m of mimeSet) {
    if (m.endsWith('/*')) continue;
    const ext = mime.extension(m);
    if (ext) extAllow.add(`.${ext}`);
  }
  // เพิ่มนามสกุลที่เราต้องการแน่นอน
  ['.jpg', '.jpeg', '.png', '.pdf'].forEach((e) => extAllow.add(e));

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dir),
    filename: (_req, file, cb) => {
      // เลือกนามสกุลจากไฟล์ ถ้าไม่ชัดเจนให้เดาจาก mimetype
      let ext = path.extname(file.originalname || '').toLowerCase();
      if (!ext || !extAllow.has(ext)) {
        const guessed = mime.extension(file.mimetype || '') || '';
        ext = guessed ? `.${guessed}` : '.bin';
      }
      const name = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
      cb(null, name);
    },
  });

  const fileFilter = (_req, file, cb) => {
    try {
      // อนุญาตตาม MIME ก่อน
      const type = (file.mimetype || '').toLowerCase();
      let ok = false;

      // เคสรอง: ถ้า config มี image/* ให้ผ่านถ้าเริ่มด้วย image/
      for (const m of mimeSet) {
        if (m.endsWith('/*')) {
          if (type.startsWith(m.replace('/*', '/'))) ok = true;
        } else if (type === m.toLowerCase()) {
          ok = true;
        }
      }
      // อนุญาต image/jpg เสมอถ้า image/jpeg ถูกอนุญาต
      if (!ok && type === 'image/jpg' && mimeSet.has('image/jpeg')) ok = true;

      // เผื่อบางเคสเบราว์เซอร์ส่ง mimetype แปลก ๆ -> ตรวจจากนามสกุล
      if (!ok) {
        const ext = path.extname(file.originalname || '').toLowerCase();
        if (extAllow.has(ext)) ok = true;
      }

      cb(ok ? null : new Error('Invalid file type'), ok);
    } catch (err) {
      cb(new Error('Invalid file type'), false);
    }
  };

  const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: maxMB * 1024 * 1024 },
  });

  const toPublicUrl = (filename) => `/uploads/${subdir}/${filename}`;
  return { upload, toPublicUrl, dir };
}

// พรีเซ็ตพร้อมใช้
const slipUpload = createUploader({
  subdir: 'slips',
  maxMB: 5,
  mimes: ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'],
});

const repairUpload = createUploader({
  subdir: 'repairs',
  maxMB: 8,
  mimes: ['image/*'], // ผ่านทุกอย่างใต้ image/
});

module.exports = { createUploader, slipUpload, repairUpload };
