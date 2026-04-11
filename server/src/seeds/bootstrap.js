const bcrypt = require("bcryptjs");
const { users, products } = require("./data");
const { getUsersByRoles, getAllProducts, saveUser, saveProduct, getDefaultShopSettings, saveShopSettings } = require("../lib/dataStore");
const { syncAvailability } = require("../lib/productLogic");

const bootstrapDemoData = async () => {
  const [existingUsers, existingProducts, settings] = await Promise.all([
    getUsersByRoles(["master_admin", "admin", "checker", "staff"]),
    getAllProducts(),
    getDefaultShopSettings()
  ]);

  if (existingUsers.length === 0) {
    for (const user of users) {
      await saveUser({
        name: user.name,
        email: user.email.toLowerCase(),
        password: await bcrypt.hash(user.password, 10),
        role: user.role,
        isActive: true
      });
    }
  }

  if (existingProducts.length === 0) {
    for (const product of products) {
      await saveProduct(syncAvailability(product));
    }
  }

  if (!settings) {
    await saveShopSettings({
      shopName: process.env.SHOP_NAME || "Fast Bites POS",
      address: process.env.SHOP_ADDRESS || "",
      logo: ""
    });
  }
};

module.exports = bootstrapDemoData;
