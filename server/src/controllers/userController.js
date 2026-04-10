const User = require("../models/User");

const getManageableRoles = (actorRole) => {
  if (actorRole === "master_admin") {
    return ["admin", "checker", "staff"];
  }

  if (actorRole === "admin") {
    return ["staff"];
  }

  return [];
};

const getVisibleRoles = (actorRole) => {
  if (actorRole === "master_admin") {
    return ["admin", "checker", "staff"];
  }

  if (actorRole === "admin") {
    return ["staff"];
  }

  return [];
};

const getUsers = async (req, res) => {
  const visibleRoles = getVisibleRoles(req.user.role);
  const users = await User.find({ role: { $in: visibleRoles } }).select("-password").sort({ createdAt: -1 });
  res.json(
    users.map((user) => ({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }))
  );
};

const createUser = async (req, res) => {
  const { name, email, password, role = "staff" } = req.body;
  const manageableRoles = getManageableRoles(req.user.role);

  if (!name || !email || !password) {
    return res.status(400).json({ message: "Name, email, and password are required" });
  }

  if (!manageableRoles.includes(role)) {
    return res.status(403).json({ message: "You cannot create a user with that role" });
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    return res.status(400).json({ message: "Email is already in use" });
  }

  const user = await User.create({
    name,
    email: email.toLowerCase(),
    password,
    role
  });

  res.status(201).json(user.toSafeObject());
};

const updateUser = async (req, res) => {
  const visibleRoles = getVisibleRoles(req.user.role);
  const manageableRoles = getManageableRoles(req.user.role);
  const user = await User.findById(req.params.id);

  if (!user || !visibleRoles.includes(user.role)) {
    return res.status(404).json({ message: "User not found" });
  }

  if (req.body.email && req.body.email.toLowerCase() !== user.email) {
    const existing = await User.findOne({ email: req.body.email.toLowerCase(), _id: { $ne: user._id } });
    if (existing) {
      return res.status(400).json({ message: "Email is already in use" });
    }
    user.email = req.body.email.toLowerCase();
  }

  user.name = req.body.name ?? user.name;
  if (req.body.role && req.body.role !== user.role) {
    if (!manageableRoles.includes(req.body.role)) {
      return res.status(403).json({ message: "You cannot assign that role" });
    }
    user.role = req.body.role;
  }
  if (typeof req.body.isActive !== "undefined") {
    user.isActive = req.body.isActive === true || req.body.isActive === "true";
  }

  if (req.body.password) {
    user.password = req.body.password;
  }

  await user.save();
  res.json(user.toSafeObject());
};

module.exports = { getUsers, createUser, updateUser };
