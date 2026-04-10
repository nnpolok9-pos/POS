const mongoose = require("mongoose");

const inventoryMovementSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true
    },
    productName: {
      type: String,
      required: true
    },
    sku: {
      type: String,
      default: ""
    },
    category: {
      type: String,
      default: ""
    },
    stockUnit: {
      type: String,
      enum: ["pieces", "gram", "teaspoon"],
      default: "pieces"
    },
    movementType: {
      type: String,
      enum: ["received", "deducted"],
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 0
    },
    previousStock: {
      type: Number,
      required: true,
      min: 0
    },
    newStock: {
      type: Number,
      required: true,
      min: 0
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    reason: {
      type: String,
      trim: true,
      default: ""
    }
  },
  {
    timestamps: true
  }
);

inventoryMovementSchema.set("toJSON", {
  transform: (_, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model("InventoryMovement", inventoryMovementSchema);
