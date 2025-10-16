// backend/routes/adminRoutes.js
const express = require('express');
const router = express.Router();

const adminCtrl = require('../controllers/adminController');
const adminTenantCtrl = require('../controllers/adminTenantController');
const debtCtrl = require('../controllers/debtController'); // ⬅ ต้องมี

// ===== Invoices (ตัวเดิม) =====
router.get('/invoices/pending', adminCtrl.getPendingInvoices);
router.post('/invoices', adminCtrl.createInvoice);
router.post('/invoices/generate-month', adminCtrl.generateMonth);
router.patch('/invoices/:id/decision', adminCtrl.decideInvoice);
router.patch('/invoices/:id/cancel', adminCtrl.cancelInvoice);
router.patch('/invoices/no/:id/cancel', adminCtrl.cancelInvoice);

// ===== Tenants (ตัวเดิม) =====
router.get('/tenants', adminTenantCtrl.listTenants);
router.post('/tenants', adminTenantCtrl.createTenant);
router.patch('/tenants/:id', adminTenantCtrl.updateTenant);
router.delete('/tenants/:id', adminTenantCtrl.deleteTenant);

// ===== Debts (ใหม่) =====
router.get('/debts/summary', debtCtrl.getDebtSummary); // ⬅ ไม่มีวงเล็บ!
router.get('/debts/search', debtCtrl.searchDebts);     // ⬅ ไม่มีวงเล็บ!

module.exports = router;
