const express = require("express");
const {
  createProduct,
  getProducts,
  getAdminProducts,
  updateProductStock,
  forceUpdateProductStock,
  deductProductStock,
  updateProduct,
  deleteProduct
} = require("../controllers/productController");
const { protect, authorize } = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");

const router = express.Router();

router.get("/public/menu", getProducts);
router.get("/", protect, getProducts);
router.get("/admin/all", protect, authorize("master_admin", "admin", "checker", "staff"), getAdminProducts);
router.post("/", protect, authorize("master_admin", "admin"), upload.single("image"), createProduct);
router.patch("/:id/stock", protect, authorize("master_admin", "admin", "staff"), updateProductStock);
router.patch("/:id/stock/force", protect, authorize("master_admin", "admin"), forceUpdateProductStock);
router.patch("/:id/stock/deduct", protect, authorize("master_admin", "admin"), deductProductStock);
router.put("/:id", protect, authorize("master_admin", "admin"), upload.single("image"), updateProduct);
router.delete("/:id", protect, authorize("master_admin", "admin"), deleteProduct);

module.exports = router;
