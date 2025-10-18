// backend/routes/adminRoutes.js
const express = require('express');
const router = express.Router();

const adminCtrl = require('../controllers/adminController');
const adminTenantCtrl = require('../controllers/adminTenantController');
const debtCtrl = require('../controllers/debtController');

// ✅ ป้องกันสิทธิ์สำหรับ route ที่มีผลกระทบ (เช่น resend)
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');

// ===== Invoices =====
router.get('/invoices/pending', adminCtrl.getPendingInvoices);
router.post('/invoices', adminCtrl.createInvoice);
router.post('/invoices/generate-month', adminCtrl.generateMonth);
router.patch('/invoices/:id/decision', adminCtrl.decideInvoice);
router.patch('/invoices/:id/cancel', adminCtrl.cancelInvoice);
router.patch('/invoices/no/:id/cancel', adminCtrl.cancelInvoice);

// ✅ NEW: ส่งการแจ้งเตือนบิลซ้ำ (หลังผู้เช่าผูก LINE แล้ว)
router.post(
  '/invoices/:id/resend',
  verifyToken,
  authorizeRoles('admin', 'staff'),
  adminCtrl.resendInvoiceNotification
);

// ===== Tenants =====
router.get('/tenants', adminTenantCtrl.listTenants);
router.post('/tenants', adminTenantCtrl.createTenant);
router.patch('/tenants/:id', adminTenantCtrl.updateTenant);
router.delete('/tenants/:id', adminTenantCtrl.deleteTenant);

// ===== Debts =====
router.get('/debts/summary', debtCtrl.getDebtSummary);
router.get('/debts/search', debtCtrl.searchDebts);

module.exports = router;
