// backend/routes/adminRoutes.js
const express = require('express');
const router = express.Router();

// ===== Controllers =====
const adminCtrl = require('../controllers/adminController');
const adminTenantCtrl = require('../controllers/adminTenantController');

// ===== ใบแจ้งหนี้ (Invoices) =====

// 🔹 ดึงใบแจ้งหนี้ที่อยู่ในสถานะ pending / unpaid
router.get('/invoices/pending', adminCtrl.getPendingInvoices);

// 🔹 สร้างใบแจ้งหนี้ใหม่ (รายบุคคล)
router.post('/invoices', adminCtrl.createInvoice);

// 🔹 สร้างใบแจ้งหนี้อัตโนมัติทั้งเดือน
router.post('/invoices/generate-month', adminCtrl.generateMonth);

// 🔹 อนุมัติ ✅ หรือ ปฏิเสธ ❌ การชำระเงินของใบแจ้งหนี้
router.patch('/invoices/:id/decision', adminCtrl.decideInvoice);

// ===== จัดการผู้เช่า (Tenants) =====
router.get('/tenants', adminTenantCtrl.listTenants);
router.post('/tenants', adminTenantCtrl.createTenant);
router.patch('/tenants/:id', adminTenantCtrl.updateTenant);
router.delete('/tenants/:id', adminTenantCtrl.deleteTenant);

module.exports = router;
