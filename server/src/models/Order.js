const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true
    },
    name: {
      type: String,
      required: true
    },
    price: {
      type: Number,
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    productType: {
      type: String,
      enum: ["raw", "raw_material", "sauce", "seasoning", "combo", "combo_type"],
      default: "raw"
    },
    components: {
      type: [
        new mongoose.Schema(
          {
            product: {
              type: mongoose.Schema.Types.ObjectId,
              ref: "Product",
              required: true
            },
            name: {
              type: String,
              required: true
            },
            quantity: {
              type: Number,
              required: true,
              min: 1
            }
          },
          { _id: false }
        )
      ],
      default: []
    },
    selectedAlternatives: {
      type: [
        new mongoose.Schema(
          {
            sourceProduct: {
              type: mongoose.Schema.Types.ObjectId,
              ref: "Product",
              required: true
            },
            sourceName: {
              type: String,
              required: true
            },
            selectedProduct: {
              type: mongoose.Schema.Types.ObjectId,
              ref: "Product",
              required: true
            },
            selectedName: {
              type: String,
              required: true
            },
            priceAdjustment: {
              type: Number,
              default: 0
            }
          },
          { _id: false }
        )
      ],
      default: []
    },
    subtotal: {
      type: Number,
      required: true
    }
  },
  { _id: false }
);

const sauceUsageSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true
    },
    name: {
      type: String,
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 0
    },
    stockUnit: {
      type: String,
      enum: ["pieces", "gram", "teaspoon"],
      default: "pieces"
    }
  },
  { _id: false }
);

const orderEditHistorySchema = new mongoose.Schema(
  {
    editedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    editedAt: {
      type: Date,
      default: Date.now
    },
    oldSubtotal: {
      type: Number,
      required: true
    },
    newSubtotal: {
      type: Number,
      required: true
    },
    oldTotal: {
      type: Number,
      required: true
    },
    newTotal: {
      type: Number,
      required: true
    },
    adjustmentType: {
      type: String,
      enum: ["add", "refund", "void", "none"],
      default: "none"
    },
    adjustmentAmount: {
      type: Number,
      default: 0
    },
    adjustmentMethod: {
      type: String,
      enum: ["cash", "card", "qr", null],
      default: null
    },
    oldPaymentMethod: {
      type: String,
      enum: ["cash", "card", "qr", null],
      default: null
    },
    newPaymentMethod: {
      type: String,
      enum: ["cash", "card", "qr", null],
      default: null
    },
    oldItems: {
      type: [orderItemSchema],
      default: []
    },
    newItems: {
      type: [orderItemSchema],
      default: []
    },
    changes: {
      type: [String],
      default: []
    }
  },
  { _id: true }
);

const bookingDetailsSchema = new mongoose.Schema(
  {
    leadTravelerName: {
      type: String,
      trim: true,
      default: ""
    },
    contactPhone: {
      type: String,
      trim: true,
      default: ""
    },
    destination: {
      type: String,
      trim: true,
      default: ""
    },
    departureDate: {
      type: Date,
      default: null
    },
    returnDate: {
      type: Date,
      default: null
    },
    travelerCount: {
      type: Number,
      min: 1,
      default: 1
    },
    notes: {
      type: String,
      trim: true,
      default: ""
    }
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      required: true,
      unique: true
    },
    items: {
      type: [orderItemSchema],
      validate: [(items) => items.length > 0, "At least one item is required"]
    },
    sauceItems: {
      type: [sauceUsageSchema],
      default: []
    },
    total: {
      type: Number,
      required: true
    },
    subtotal: {
      type: Number,
      required: true
    },
    paymentMethod: {
      type: String,
      enum: ["cash", "card", "qr", null],
      default: null
    },
    bookingDetails: {
      type: bookingDetailsSchema,
      default: () => ({})
    },
    status: {
      type: String,
      enum: ["queued", "food_serving", "completed", "void", "quote_prepared", "confirmed"],
      default: "food_serving"
    },
    queueNumber: {
      type: String,
      default: ""
    },
    source: {
      type: String,
      enum: ["staff", "customer"],
      default: "staff"
    },
    originalSubtotal: {
      type: Number,
      default: null
    },
    originalTotal: {
      type: Number,
      default: null
    },
    staff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    voidedAt: {
      type: Date,
      default: null
    },
    voidedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    editedAt: {
      type: Date,
      default: null
    },
    editedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    editHistory: {
      type: [orderEditHistorySchema],
      default: []
    },
    servedAt: {
      type: Date,
      default: null
    },
    servedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    }
  },
  {
    timestamps: true
  }
);

orderSchema.set("toJSON", {
  transform: (_, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model("Order", orderSchema);
