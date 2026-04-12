const bcrypt = require("bcryptjs");
const { getUserByEmail } = require("../lib/dataStore");
const generateToken = require("../utils/generateToken");

const toSafeUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  avatar: user.avatar || "",
  role: user.role
});

const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  const user = await getUserByEmail(String(email).toLowerCase());

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  if (!user.isActive) {
    return res.status(403).json({ message: "User account is inactive" });
  }

  return res.json({
    token: generateToken(user.id),
    user: toSafeUser(user)
  });
};

const me = async (req, res) => {
  res.json(req.user);
};

module.exports = { login, me, toSafeUser };
