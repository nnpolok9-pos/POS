const mongoose = require("mongoose");

const shopSettingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      unique: true,
      default: "default"
    },
    shopName: {
      type: String,
      required: true,
      trim: true,
      default: "Skyline Journeys POS"
    },
    address: {
      type: String,
      trim: true,
      default: ""
    },
    logo: {
      type: String,
      default: ""
    }
  },
  {
    timestamps: true
  }
);

shopSettingsSchema.set("toJSON", {
  virtuals: true,
  transform: (_, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model("ShopSettings", shopSettingsSchema);
