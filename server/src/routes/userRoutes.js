const express = require("express");
const { createUser, getUsers, updateUser, getProfile, updateProfile } = require("../controllers/userController");
const { protect, authorize } = require("../middleware/authMiddleware");
const userUpload = require("../middleware/userUploadMiddleware");

const router = express.Router();

router.get("/profile", protect, authorize("master_admin", "admin", "checker", "staff"), getProfile);
router.put("/profile", protect, authorize("master_admin", "admin", "checker", "staff"), userUpload.single("avatar"), updateProfile);
router.get("/", protect, authorize("master_admin", "admin"), getUsers);
router.post("/", protect, authorize("master_admin", "admin"), createUser);
router.put("/:id", protect, authorize("master_admin", "admin"), updateUser);

module.exports = router;
