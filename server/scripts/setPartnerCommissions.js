require("dotenv").config();

const { connectDB, disconnectDB } = require("../src/config/db");
const { getPartnerSettingByKey, savePartnerSetting, getAllPartnerSettings } = require("../src/lib/dataStore");

const COMMISSION_UPDATES = {
  foodpanda: 27.5,
  grab: 27.5,
  e_gates: 22,
  wownow: 22
};

const run = async () => {
  await connectDB();

  for (const [partnerKey, commissionRate] of Object.entries(COMMISSION_UPDATES)) {
    const existing = await getPartnerSettingByKey(partnerKey);
    await savePartnerSetting({
      ...existing,
      partnerKey,
      commissionRate
    });
  }

  const allSettings = await getAllPartnerSettings();
  allSettings
    .filter((setting) => Object.prototype.hasOwnProperty.call(COMMISSION_UPDATES, setting.partnerKey))
    .forEach((setting) => {
      console.log(`${setting.partnerName}: ${setting.commissionRate}%`);
    });
};

run()
  .catch((error) => {
    console.error("Failed to update partner commissions:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await disconnectDB();
    } catch {}
  });
