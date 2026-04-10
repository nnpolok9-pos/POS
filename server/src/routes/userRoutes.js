const express = require("express");
const { createUser, getUsers, updateUser } = require("../controllers/userController");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", protect, authorize("master_admin", "admin"), getUsers);
router.post("/", protect, authorize("master_admin", "admin"), createUser);
router.put("/:id", protect, authorize("master_admin", "admin"), updateUser);

module.exports = router;
