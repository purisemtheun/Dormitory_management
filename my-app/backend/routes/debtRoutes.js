// backend/routes/debtRoutes.js
const express = require('express');
const router = express.Router();
const debtCtrl = require('../controllers/debtController');
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');

router.use(verifyToken, authorizeRoles('admin','staff'));

/* สรุปตัวเลขการ์ด */
router.get('/summary', debtCtrl.getDebtSummary);

/* ตารางค้นหา */
router.get('/search', debtCtrl.searchDebts);

module.exports = router;
