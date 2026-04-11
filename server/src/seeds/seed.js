require("dotenv").config();
const bcrypt = require("bcryptjs");
const { connectDB, disconnectDB } = require("../config/db");
const { users, products } = require("./data");
const { clearCoreData, saveUser, saveProduct, saveShopSettings } = require("../lib/dataStore");
const { syncAvailability } = require("../lib/productLogic");

const seed = async () => {
  try {
    await connectDB();
    await clearCoreData();

    for (const user of users) {
      await saveUser({
        name: user.name,
        email: user.email.toLowerCase(),
        password: await bcrypt.hash(user.password, 10),
        role: user.role,
        isActive: true
      });
    }

    for (const product of products) {
      await saveProduct(syncAvailability(product));
    }

    await saveShopSettings({
      shopName: process.env.SHOP_NAME || "Fast Bites POS",
      address: process.env.SHOP_ADDRESS || "",
      logo: ""
    });

    console.log("Seed data inserted successfully");
    await disconnectDB();
    process.exit(0);
  } catch (error) {
    console.error("Seed failed:", error);
    process.exit(1);
  }
};

seed();
