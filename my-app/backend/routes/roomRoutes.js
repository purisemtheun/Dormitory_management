const express = require('express');
const router = express.Router();
const {
  createRoom,
  getRooms,
  getRoomById,
  bookRoomForTenant,
  updateRoom,
  deleteRoom
} = require('../controllers/roomController');
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');

// ทุก route ต้องตรวจ JWT ก่อน
router.use(verifyToken);

// === Admin only ===
router.post('/', authorizeRoles('admin'), createRoom);
router.patch('/:id', authorizeRoles('admin'), updateRoom);
router.delete('/:id', authorizeRoles('admin'), deleteRoom);
router.post('/:id/book', authorizeRoles('admin'), bookRoomForTenant);

// === Shared ===
router.get('/', authorizeRoles('admin','tenant'), getRooms);
router.get('/:id', authorizeRoles('admin','tenant'), getRoomById);

module.exports = router;