const express = require("express");
const {
  createCashHandover,
  getCashPosition,
  getCashUsers
} = require("../controllers/cashManagementController");
const { authorize, protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/users", protect, authorize("master_admin", "admin", "checker"), getCashUsers);
router.get("/position", protect, authorize("master_admin", "admin", "checker"), getCashPosition);
router.post("/handovers", protect, authorize("master_admin"), createCashHandover);

module.exports = router;
