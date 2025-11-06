// backend/routes/reports.routes.js
const router = require('express').Router();
const reports = require('../controllers/reports.controller');

// ===== Rooms / Status =====
router.get('/rooms-status', reports.getRoomsStatus);

// ===== Revenue =====
router.get('/monthly-summary', reports.monthlySummary);
router.get('/revenue-daily', reports.getRevenueDaily);

// ===== Payments & Debts =====
router.get('/payments', reports.getPayments);
router.get('/debts', reports.getDebts);

// ===== Utilities (water/electric) =====
router.get('/meter-monthly', reports.getMeterMonthlySimple);
router.post('/meter/save-simple', reports.saveMeterSimple);
router.post('/meter/toggle-lock', reports.toggleMeterLock);

module.exports = router;
