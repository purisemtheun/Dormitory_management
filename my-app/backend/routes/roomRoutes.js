const router = require('express').Router();
const roomController = require('../controllers/roomController');
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');

// tenant ดูห้องของตัวเอง
router.get('/mine', verifyToken, roomController.getMyRoom);

// เฉพาะ admin/staff
router.get('/',       verifyToken, authorizeRoles('admin','staff'), roomController.listRooms);
router.post('/',      verifyToken, authorizeRoles('admin','staff'), roomController.createRoom);
router.patch('/:id',  verifyToken, authorizeRoles('admin','staff'), roomController.updateRoom);
router.delete('/:id', verifyToken, authorizeRoles('admin','staff'), roomController.deleteRoom);
router.post('/:id/book', verifyToken, authorizeRoles('admin','staff'), roomController.bookRoomForTenant);

module.exports = router;
