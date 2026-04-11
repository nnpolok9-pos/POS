const fs = require("fs");
const path = require("path");
const { getDefaultShopSettings, saveShopSettings } = require("../lib/dataStore");

const buildLogoPath = (file) => (file ? `/uploads/settings/${file.filename}` : "");

const getOrCreateSettings = async () => {
  const existing = await getDefaultShopSettings();

  if (existing) {
    return existing;
  }

  return saveShopSettings({
    shopName: process.env.SHOP_NAME || "Fast Bites POS",
    address: process.env.SHOP_ADDRESS || "",
    logo: ""
  });
};

const getShopSettings = async (_req, res) => {
  const settings = await getOrCreateSettings();
  res.json(settings);
};

const updateShopSettings = async (req, res) => {
  const settings = await getOrCreateSettings();
  const previousLogo = settings.logo;

  const nextSettings = await saveShopSettings({
    shopName: req.body.shopName?.trim() || settings.shopName,
    address: req.body.address?.trim?.() ?? req.body.address ?? settings.address,
    logo: req.file ? buildLogoPath(req.file) : settings.logo
  });

  if (req.file && previousLogo) {
    const oldLogoPath = path.join(process.cwd(), "src", previousLogo.replace(/^\//, ""));
    if (fs.existsSync(oldLogoPath)) {
      fs.unlinkSync(oldLogoPath);
    }
  }

  res.json(nextSettings);
};

module.exports = { getShopSettings, updateShopSettings, getOrCreateSettings };
