const express = require("express");
const {
  getSalesReport,
  getLowStockProducts,
  getDashboardSummary,
  getSalesRangeReport,
  getProductSalesReport,
  getCashPositionReport,
  getOrdersByDate
} = require("../controllers/reportController");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/sales", protect, authorize("master_admin", "admin", "checker"), getSalesReport);
router.get("/sales-range", protect, authorize("master_admin", "admin", "checker"), getSalesRangeReport);
router.get("/product-sales", protect, authorize("master_admin", "admin", "checker"), getProductSalesReport);
router.get("/cash-position", protect, authorize("master_admin", "admin", "checker"), getCashPositionReport);
router.get("/orders-by-date", protect, authorize("master_admin", "admin", "checker"), getOrdersByDate);
router.get("/low-stock", protect, authorize("master_admin", "admin", "checker"), getLowStockProducts);
router.get("/dashboard", protect, authorize("master_admin", "admin", "checker"), getDashboardSummary);

module.exports = router;
