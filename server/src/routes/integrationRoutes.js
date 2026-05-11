const express = require("express");
const { getWebhookLogs, receivePartnerWebhook } = require("../controllers/integrationController");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/webhooks/logs", protect, authorize("master_admin", "admin"), getWebhookLogs);
router.post("/webhooks/:partner", receivePartnerWebhook);

module.exports = router;
