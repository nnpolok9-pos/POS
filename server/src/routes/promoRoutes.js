const express = require("express");
const { listPromos, previewPromo, createPromo, updatePromo, removePromo } = require("../controllers/promoController");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/preview", previewPromo);
router.get("/", protect, authorize("master_admin", "admin"), listPromos);
router.post("/", protect, authorize("master_admin", "admin"), createPromo);
router.put("/:id", protect, authorize("master_admin", "admin"), updatePromo);
router.delete("/:id", protect, authorize("master_admin", "admin"), removePromo);

module.exports = router;
