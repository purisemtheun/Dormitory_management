// routes/roomRoutes.js
const express = require('express');
const router = express.Router();
const {
  createRoom,
  getRooms,
  getRoomById,
  bookRoomForTenant
} = require('../controllers/roomController');
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');

// ทุก route ต้องตรวจ JWT ก่อน
router.use(verifyToken);

// POST /api/rooms — สร้างห้อง (admin เท่านั้น)
router.post('/', authorizeRoles('admin'), createRoom);

// GET /api/rooms — ดูรายการห้อง (admin ดูทุก, tenant ดูเฉพาะของตัวเอง)
router.get('/', authorizeRoles('admin','tenant'), getRooms);

// GET /api/rooms/:id — ดูรายละเอียดห้อง (admin หรือ tenant ของห้องนั้น)
router.get('/:id', authorizeRoles('admin','tenant'), getRoomById);

// POST /api/rooms/:id/book — จองห้องให้ tenant (admin และ tenant)
router.post(
  '/:id/book',
  authorizeRoles('admin'), // เฉพาะ admin เท่านั้น
  bookRoomForTenant
);

module.exports = router;
