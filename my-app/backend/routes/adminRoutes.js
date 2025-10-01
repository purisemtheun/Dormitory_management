// backend/routes/adminRoutes.js
const express = require('express');
const router = express.Router();

const adminTenantController = require('../controllers/adminTenantController');
// ✅ ดึง middleware ให้ครบ
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');

// ✅ ป้องกันสิทธิ์: admin/staff เท่านั้น
router.get('/tenants',        verifyToken, authorizeRoles('admin','staff'), adminTenantController.listTenants);
router.post('/tenants',       verifyToken, authorizeRoles('admin','staff'), adminTenantController.createTenant);
router.patch('/tenants/:id',  verifyToken, authorizeRoles('admin','staff'), adminTenantController.updateTenant);
router.delete('/tenants/:id', verifyToken, authorizeRoles('admin','staff'), adminTenantController.deleteTenant);

module.exports = router;
