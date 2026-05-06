const { getAllPartnerSettings, getPartnerSettingByKey, savePartnerSetting } = require("../lib/dataStore");
const { PARTNER_KEYS, PARTNER_LABELS, normalizePartnerSetting } = require("../utils/partnerSettings");

const getPartners = async (_req, res) => {
  const settings = await getAllPartnerSettings();
  res.json(settings);
};

const getPartnerByKey = async (req, res) => {
  const partnerKey = String(req.params.partnerKey || "").trim();

  if (!PARTNER_KEYS.includes(partnerKey)) {
    return res.status(404).json({ message: "Partner not found" });
  }

  const setting = await getPartnerSettingByKey(partnerKey);
  res.json(setting);
};

const updatePartnerByKey = async (req, res) => {
  const partnerKey = String(req.params.partnerKey || "").trim();

  if (!PARTNER_KEYS.includes(partnerKey)) {
    return res.status(404).json({ message: "Partner not found" });
  }

  const payload = normalizePartnerSetting({
    ...req.body,
    partnerKey,
    partnerName: req.body?.partnerName || PARTNER_LABELS[partnerKey] || partnerKey
  });

  const saved = await savePartnerSetting(payload);
  res.json(saved);
};

module.exports = {
  getPartners,
  getPartnerByKey,
  updatePartnerByKey
};
