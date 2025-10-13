// backend/routes/debtRoutes.js
const express = require("express");
const router = express.Router();

const { verifyToken, authorizeRoles } = require("../middlewares/authMiddleware");
const debt = require("../controllers/debtController");

// แอดมิน/ผู้จัดการ/สตาฟ เท่านั้น
router.get(
  "/",
  verifyToken,
  authorizeRoles("admin", "manager", "staff"),
  debt.search
);

router.get(
  "/:tenant_id/detail",
  verifyToken,
  authorizeRoles("admin", "manager", "staff"),
  debt.detailByTenant
);

module.exports = router;
