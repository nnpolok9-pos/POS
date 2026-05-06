const express = require("express");
const { getPartners, getPartnerByKey, updatePartnerByKey } = require("../controllers/partnerSettingsController");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", protect, authorize("master_admin", "admin"), getPartners);
router.get("/:partnerKey", protect, authorize("master_admin", "admin"), getPartnerByKey);
router.put("/:partnerKey", protect, authorize("master_admin", "admin"), updatePartnerByKey);

module.exports = router;
