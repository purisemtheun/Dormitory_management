const express = require('express');
const router = express.Router();

const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/repairUpload');
const repairController = require('../controllers/repairController');

// Routes
router.post('/', verifyToken, upload.single('image'), repairController.createRepair);
router.get('/', verifyToken, repairController.getAllRepairs);
router.get('/:id', verifyToken, repairController.getRepairById);
router.post('/:id/assign', verifyToken, authorizeRoles('admin'), repairController.assignRepair);
router.patch('/:id', verifyToken, repairController.updateRepair);
router.delete('/:id', verifyToken, authorizeRoles('admin'), repairController.deleteRepair);

module.exports = router;