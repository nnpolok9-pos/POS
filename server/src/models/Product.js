const mongoose = require("mongoose");

const comboAlternativeSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true
    },
    priceAdjustment: {
      type: Number,
      default: 0
    }
  },
  { _id: false }
);

const comboItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    changeable: {
      type: Boolean,
      default: false
    },
    alternativeProducts: {
      type: [comboAlternativeSchema],
      default: []
    }
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    khmerName: {
      type: String,
      trim: true,
      default: ""
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    regularPrice: {
      type: Number,
      min: 0,
      default: null
    },
    promotionalPrice: {
      type: Number,
      min: 0,
      default: null
    },
    category: {
      type: String,
      required: true,
      trim: true
    },
    khmerCategory: {
      type: String,
      trim: true,
      default: ""
    },
    description: {
      type: String,
      trim: true,
      default: ""
    },
    khmerDescription: {
      type: String,
      trim: true,
      default: ""
    },
    image: {
      type: String,
      default: ""
    },
    stock: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },
    stockUnit: {
      type: String,
      enum: ["pieces", "gram", "teaspoon"],
      default: "pieces"
    },
    seasoningPerOrderConsumption: {
      type: Number,
      min: 0,
      default: 0
    },
    expiryDate: {
      type: Date,
      default: null
    },
    productType: {
      type: String,
      enum: ["raw", "raw_material", "sauce", "seasoning", "combo", "combo_type"],
      default: "raw"
    },
    comboItems: {
      type: [comboItemSchema],
      default: []
    },
    forSale: {
      type: Boolean,
      default: true
    },
    sku: {
      type: String,
      unique: true,
      trim: true
    },
    isActive: {
      type: Boolean,
      default: true
    },
    lowStockThreshold: {
      type: Number,
      default: 5
    }
  },
  {
    timestamps: true
  }
);

productSchema.virtual("lowStock").get(function lowStock() {
  if (["combo", "combo_type"].includes(this.productType)) {
    return false;
  }
  return this.stock <= this.lowStockThreshold;
});

productSchema.set("toJSON", {
  virtuals: true,
  transform: (_, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model("Product", productSchema);
