const express = require('express');
const router = express.Router();
const adminTenantController = require('../controllers/adminTenantController');

router.get('/tenants', adminTenantController.listTenants);
router.post('/tenants', adminTenantController.createTenant);
router.patch('/tenants/:id', adminTenantController.updateTenant);
router.delete('/tenants/:id', adminTenantController.deleteTenant);

module.exports = router;
