const express = require("express");
const { getInventoryReport } = require("../controllers/inventoryController");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/report", protect, authorize("master_admin", "admin", "checker", "staff"), getInventoryReport);

module.exports = router;
