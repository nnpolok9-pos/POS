const express = require("express");
const {
  createOrder,
  createPublicOrder,
  getOrders,
  getEditedOrders,
  getOrderById,
  updateOrder,
  voidOrder,
  editVoidOrder,
  serveOrder,
  deleteOrder
} = require("../controllers/orderController");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/public/queue", createPublicOrder);
router.post("/", protect, authorize("master_admin", "admin", "staff"), createOrder);
router.get("/", protect, authorize("master_admin", "admin", "checker", "staff"), getOrders);
router.get("/edited-list", protect, authorize("master_admin", "admin", "checker"), getEditedOrders);
router.get("/:id", protect, authorize("master_admin", "admin", "checker", "staff"), getOrderById);
router.put("/:id", protect, authorize("master_admin", "admin", "staff"), updateOrder);
router.patch("/:id/serve", protect, authorize("master_admin", "admin", "staff"), serveOrder);
router.patch("/:id/void", protect, authorize("master_admin", "admin", "staff"), voidOrder);
router.patch("/:id/void-edit", protect, authorize("master_admin", "admin"), editVoidOrder);
router.delete("/:id", protect, authorize("master_admin"), deleteOrder);

module.exports = router;
