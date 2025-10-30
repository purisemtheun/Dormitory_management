const express = require('express');
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');
const ctrl = require('../controllers/reports.controller.js');

const router = express.Router();
router.use(verifyToken, authorizeRoles('admin', 'staff'));

router.get('/rooms-status', ctrl.getRoomsStatus);

/* รายรับ */
router.get('/revenue',        ctrl.getRevenue);       // เดิม (รองรับ granularity=daily)
router.get('/revenue-daily',  ctrl.getRevenueDaily);  // ✅ ใหม่: เรียกตรงสำหรับรายวัน

/* การชำระ/หนี้ */
router.get('/payments',       ctrl.getPayments);
router.get('/debts',          ctrl.getDebts);

/* Utilities (ค่าน้ำ/ไฟ) */
router.get('/meter-monthly',      ctrl.getMeterMonthlySimple);
router.post('/meter/save-simple', ctrl.saveMeterSimple);
router.post('/meter-reading',     ctrl.saveMeterSimple); // alias เดิม
router.post('/meter/toggle-lock', ctrl.toggleMeterLock);

/* รายเดือนรวมทั้งหอ + แตกห้อง */
router.get('/monthly-summary',       ctrl.monthlySummary);
router.get('/monthly-breakdown/:ym', ctrl.monthlyBreakdown);

module.exports = router;
