const User = require("../models/User");
const Product = require("../models/Product");
const ShopSettings = require("../models/ShopSettings");
const { users, products } = require("./data");

const bootstrapDemoData = async () => {
  const [userCount, productCount] = await Promise.all([User.countDocuments(), Product.countDocuments()]);

  if (userCount === 0) {
    for (const user of users) {
      await User.create(user);
    }
  }

  if (productCount === 0) {
    await Product.insertMany(products);
  }

  const settings = await ShopSettings.findOne({ key: "default" });
  if (!settings) {
    await ShopSettings.create({
      key: "default",
    shopName: process.env.SHOP_NAME || "Skyline Journeys POS",
      address: process.env.SHOP_ADDRESS || "",
      logo: ""
    });
  }
};

module.exports = bootstrapDemoData;
