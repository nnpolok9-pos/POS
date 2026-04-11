const bcrypt = require("bcryptjs");
const { toSafeUser } = require("./authController");
const {
  saveUser,
  getUsersByRoles,
  getUserById,
  getUserByEmail,
  findUserByEmailExcludingId
} = require("../lib/dataStore");

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
  const users = await getUsersByRoles(getVisibleRoles(req.user.role));
  res.json(
    users.map((user) => ({
      ...toSafeUser(user),
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

  const normalizedEmail = String(email).toLowerCase();
  const existing = await getUserByEmail(normalizedEmail);

  if (existing) {
    return res.status(400).json({ message: "Email is already in use" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await saveUser({
    name,
    email: normalizedEmail,
    password: passwordHash,
    role,
    isActive: true
  });

  res.status(201).json(toSafeUser(user));
};

const updateUser = async (req, res) => {
  const visibleRoles = getVisibleRoles(req.user.role);
  const manageableRoles = getManageableRoles(req.user.role);
  const user = await getUserById(req.params.id);

  if (!user || !visibleRoles.includes(user.role)) {
    return res.status(404).json({ message: "User not found" });
  }

  let email = user.email;
  if (req.body.email && String(req.body.email).toLowerCase() !== user.email) {
    const normalizedEmail = String(req.body.email).toLowerCase();
    const existing = await findUserByEmailExcludingId(normalizedEmail, user.id);
    if (existing) {
      return res.status(400).json({ message: "Email is already in use" });
    }
    email = normalizedEmail;
  }

  let role = user.role;
  if (req.body.role && req.body.role !== user.role) {
    if (!manageableRoles.includes(req.body.role)) {
      return res.status(403).json({ message: "You cannot assign that role" });
    }
    role = req.body.role;
  }

  const isActive =
    typeof req.body.isActive !== "undefined" ? req.body.isActive === true || req.body.isActive === "true" : user.isActive;

  const passwordHash = req.body.password ? await bcrypt.hash(req.body.password, 10) : user.password;

  const updated = await saveUser({
    id: user.id,
    name: req.body.name ?? user.name,
    email,
    password: passwordHash,
    role,
    isActive
  });

  res.json(toSafeUser(updated));
};

module.exports = { getUsers, createUser, updateUser };
