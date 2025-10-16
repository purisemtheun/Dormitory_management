// backend/routes/debtRoutes.js
const express = require('express');
const router = express.Router();
const debtCtrl = require('../controllers/debtController');

// สรุป
router.get('/summary', debtCtrl.getDebtSummary);

// ค้นหา
router.get('/search', debtCtrl.searchDebts);

module.exports = router;
