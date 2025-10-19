// backend/routes/dashboardRoutes.js
const express = require('express');
const router = express.Router();
const dash = require('../controllers/dashboardController');

// ดึงข้อมูลสรุป dashboard (แอดมิน)
router.get('/', dash.getAdminDashboard);

module.exports = router;
