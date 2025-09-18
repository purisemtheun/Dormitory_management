const express = require('express');
const router = express.Router();
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');
const adminTenantController = require('../controllers/adminTenantController');

router.get('/tenants', verifyToken, authorizeRoles('admin'), adminTenantController.listTenants);

module.exports = router;