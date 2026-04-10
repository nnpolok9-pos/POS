const fs = require("fs");
const path = require("path");
const ShopSettings = require("../models/ShopSettings");

const buildLogoPath = (file) => (file ? `/uploads/settings/${file.filename}` : "");

const getOrCreateSettings = async () => {
  let settings = await ShopSettings.findOne({ key: "default" });

  if (!settings) {
    settings = await ShopSettings.create({
      key: "default",
      shopName: process.env.SHOP_NAME || "Fast Bites POS",
      address: process.env.SHOP_ADDRESS || "",
      logo: ""
    });
  }

  return settings;
};

const getShopSettings = async (_req, res) => {
  const settings = await getOrCreateSettings();
  res.json(settings.toJSON());
};

const updateShopSettings = async (req, res) => {
  const settings = await getOrCreateSettings();
  const previousLogo = settings.logo;

  settings.shopName = req.body.shopName?.trim() || settings.shopName;
  settings.address = req.body.address?.trim?.() ?? req.body.address ?? settings.address;

  if (req.file) {
    settings.logo = buildLogoPath(req.file);
  }

  await settings.save();

  if (req.file && previousLogo) {
    const oldLogoPath = path.join(process.cwd(), "src", previousLogo.replace(/^\//, ""));
    if (fs.existsSync(oldLogoPath)) {
      fs.unlinkSync(oldLogoPath);
    }
  }

  res.json(settings.toJSON());
};

module.exports = { getShopSettings, updateShopSettings, getOrCreateSettings };
