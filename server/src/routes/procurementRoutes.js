const express = require("express");
const {
  createCost,
  createPurchase,
  createPayment,
  deleteCost,
  deletePurchase,
  getCostNames,
  getCosts,
  getCostwiseReport,
  getPurchaseItemwiseReport,
  getPurchases,
  getPurchaseUsers,
  getVendorWiseReport,
  getVendors,
  updateCost,
  updatePurchase
} = require("../controllers/procurementController");
const { authorize, protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", protect, authorize("master_admin"), getPurchases);
router.get("/vendors", protect, authorize("master_admin"), getVendors);
router.get("/users", protect, authorize("master_admin"), getPurchaseUsers);
router.get("/cost-names", protect, authorize("master_admin"), getCostNames);
router.get("/costs", protect, authorize("master_admin"), getCosts);
router.get("/reports/itemwise", protect, authorize("master_admin"), getPurchaseItemwiseReport);
router.get("/reports/costwise", protect, authorize("master_admin"), getCostwiseReport);
router.get("/reports/vendor-wise", protect, authorize("master_admin"), getVendorWiseReport);
router.post("/", protect, authorize("master_admin"), createPurchase);
router.post("/payments", protect, authorize("master_admin"), createPayment);
router.post("/costs", protect, authorize("master_admin"), createCost);
router.put("/costs/:id", protect, authorize("master_admin"), updateCost);
router.delete("/costs/:id", protect, authorize("master_admin"), deleteCost);
router.put("/:id", protect, authorize("master_admin"), updatePurchase);
router.delete("/:id", protect, authorize("master_admin"), deletePurchase);

module.exports = router;
