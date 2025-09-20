// backend/routes/roomRoutes.js
const router = require('express').Router();
const roomController = require('../controllers/roomController');

// พื้นฐาน
router.get('/',        roomController.listRooms);
router.post('/',       roomController.createRoom);
router.patch('/:id',   roomController.updateRoom);
router.delete('/:id',  roomController.deleteRoom);

// ✅ ผูกห้องให้ผู้เช่า
router.post('/:id/book', roomController.bookRoomForTenant);

module.exports = router;
