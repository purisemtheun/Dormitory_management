// routes/repairRoutes.js
const express = require('express');
const router = express.Router();
const {
  createRepair, getAllRepairs, getRepairById,
  assignRepair, deleteRepair,
  updateRepair              // ✅ เพิ่มบรรทัดนี้
} = require('../controllers/repairController');
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');

router.use(verifyToken);

router.post('/', authorizeRoles('tenant'), createRepair);
router.get('/', authorizeRoles('tenant','admin','technician'), getAllRepairs);
router.get('/:id', authorizeRoles('tenant','admin','technician'), getRepairById);

// ✅ อัปเดตใบแจ้งซ่อม (tenant/admin เท่านั้น)
router.patch('/:id', authorizeRoles('tenant','admin'), updateRepair);

// มอบหมายทีละงาน (admin เท่านั้น)
router.patch('/:id/assign', authorizeRoles('admin'), assignRepair);

router.delete('/:id', authorizeRoles('admin'), deleteRepair);

module.exports = router;








