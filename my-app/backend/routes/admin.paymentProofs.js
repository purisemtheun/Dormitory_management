// routes/admin.paymentProofs.js
const express = require('express');
const { requireAdmin } = require('../middlewares/auth');
const { approveProof, rejectProof } = require('../controllers/paymentProof.controller');

const router = express.Router();
router.use(requireAdmin);

// อนุมัติ/ปฏิเสธสลิป
router.patch('/payment-proofs/:id/approve', approveProof);
router.patch('/payment-proofs/:id/reject', rejectProof);

module.exports = router;
