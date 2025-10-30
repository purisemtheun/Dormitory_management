const express = require('express');
const router = express.Router();

const adminTenantCtrl = require('../controllers/adminTenantController');
const debtCtrl = require('../controllers/debtController');
// เปลี่ยนบรรทัดนี้ให้ชี้ไปที่ไฟล์ที่มีฟังก์ชันจริง
const invoiceCtrl = require('../controllers/adminController');

const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');

/* ===== Invoices ===== */

// ประวัติล่าสุด: GET /api/admin/invoices?limit=10
router.get(
  '/invoices',
  verifyToken,
  authorizeRoles('admin','manager','staff'),
  invoiceCtrl.listRecentInvoices
);

// บิลรออนุมัติ
router.get(
  '/invoices/pending',
  verifyToken,
  authorizeRoles('admin','manager','staff'),
  invoiceCtrl.getPendingInvoices
);

// ออกบิลรายคน
router.post(
  '/invoices',
  verifyToken,
  authorizeRoles('admin','manager','staff'),
  invoiceCtrl.createInvoice
);

// ออกบิลทั้งเดือน
router.post(
  '/invoices/generate-month',
  verifyToken,
  authorizeRoles('admin','manager','staff'),
  invoiceCtrl.generateMonth
);

// ตัดสินใจอนุมัติ/ปฏิเสธ
router.patch(
  '/invoices/:id/decision',
  verifyToken,
  authorizeRoles('admin','manager','staff'),
  invoiceCtrl.decideInvoice
);

// ยกเลิกบิล (รับ id หรือ invoice_no)
router.patch(
  '/invoices/:id/cancel',
  verifyToken,
  authorizeRoles('admin','manager','staff'),
  invoiceCtrl.cancelInvoice
);
router.patch(
  '/invoices/no/:id/cancel',
  verifyToken,
  authorizeRoles('admin','manager','staff'),
  invoiceCtrl.cancelInvoice
);

// ส่งแจ้งเตือนซ้ำ
router.post(
  '/invoices/:id/resend',
  verifyToken,
  authorizeRoles('admin','manager','staff'),
  invoiceCtrl.resendInvoiceNotification
);

/* ===== Tenants ===== */
router.get('/tenants', adminTenantCtrl.listTenants);
router.post('/tenants', adminTenantCtrl.createTenant);
router.patch('/tenants/:id', adminTenantCtrl.updateTenant);
router.delete('/tenants/:id', adminTenantCtrl.deleteTenant);

/* ===== Debts ===== */
router.get('/debts/summary', debtCtrl.getDebtSummary);
router.get('/debts/search', debtCtrl.searchDebts);

module.exports = router;
