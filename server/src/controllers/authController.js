const User = require("../models/User");
const generateToken = require("../utils/generateToken");

const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  const user = await User.findOne({ email: email.toLowerCase() });

  if (!user || !(await user.comparePassword(password))) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  if (!user.isActive) {
    return res.status(403).json({ message: "User account is inactive" });
  }

  return res.json({
    token: generateToken(user._id),
    user: user.toSafeObject()
  });
};

const me = async (req, res) => {
  res.json(req.user);
};

module.exports = { login, me };
