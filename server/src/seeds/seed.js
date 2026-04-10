require("dotenv").config();
const { connectDB, disconnectDB } = require("../config/db");
const User = require("../models/User");
const Product = require("../models/Product");
const { users, products } = require("./data");

const seed = async () => {
  try {
    await connectDB();
    await User.deleteMany();
    await Product.deleteMany();
    for (const user of users) {
      await User.create(user);
    }
    await Product.insertMany(products);
    console.log("Seed data inserted successfully");
    await disconnectDB();
    process.exit(0);
  } catch (error) {
    console.error("Seed failed:", error);
    process.exit(1);
  }
};

seed();
