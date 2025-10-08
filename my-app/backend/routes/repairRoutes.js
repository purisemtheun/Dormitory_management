// backend/routes/repairRoutes.js
const express = require('express');
const router = express.Router();

const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/repairUpload');
const repairController = require('../controllers/repairController');

// ---- สร้าง / ดึงรายการ ----
router.post('/', verifyToken, upload.single('image'), repairController.createRepair);
router.get('/', verifyToken, repairController.getAllRepairs);

// ---- รายชื่อช่างสำหรับ dropdown (วางก่อน :id) ----
router.get('/admin/technicians', verifyToken, authorizeRoles('admin'), repairController.listTechnicians);

// ---- เส้นทางที่มีพารามิเตอร์ id (เรียงจากเฉพาะทาง -> ทั่วไป) ----
router.patch('/:id/assign', verifyToken, authorizeRoles('admin'), repairController.assignRepair);   // มอบหมายช่าง
router.patch('/:id/status', verifyToken, authorizeRoles('admin'), repairController.adminSetStatus); // เปลี่ยนสถานะ (เช่น rejected)

router.get('/:id', verifyToken, repairController.getRepairById);
router.patch('/:id', verifyToken, repairController.updateRepair); // แก้ title/description/due_date
router.delete('/:id', verifyToken, authorizeRoles('admin'), repairController.deleteRepair);

module.exports = router;
