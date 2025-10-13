// routes/debtRoutes.js
const express = require('express');
const {
  searchDebts,
  getTenantDebtDetail,
  getDebtSummaryDashboard
} = require('../controllers/debtController.js');

const router = express.Router();

router.get('/search', searchDebts);
router.get('/tenant/:tenantId', getTenantDebtDetail);
router.get('/summary', getDebtSummaryDashboard);

module.exports = router;
