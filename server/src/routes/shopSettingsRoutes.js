const express = require("express");
const { getShopSettings, updateShopSettings } = require("../controllers/shopSettingsController");
const { protect, authorize } = require("../middleware/authMiddleware");
const upload = require("../middleware/settingsUploadMiddleware");

const router = express.Router();

router.get("/public", getShopSettings);
router.get("/", protect, authorize("master_admin", "admin", "checker", "staff"), getShopSettings);
router.put("/", protect, authorize("master_admin"), upload.single("logo"), updateShopSettings);

module.exports = router;
