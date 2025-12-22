const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({

  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  items: [
    {
      productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Listing",
        required: true
      },
      quantity: {
        type: Number,
        required: true,
        min: 1
      }
    }
  ],

  // User Details
  name: String,
  mobile: String,

  // Address
  pincode: String,
  state: String,
  city: String,
  locality: String,
  house: String,
  landmark: String,

  // Payment
  isVerified: { type: Boolean, default: false },
  paymentMethod: { type: String, enum: ["Cash on Delivery", "Online"], default: "Cash on Delivery" },

  // Status
  status: { type: String, enum: ["Pending", "Confirmed", "Cancelled", "Delivered"], default: "Pending" },

  // Timestamps
  orderDate: { type: Date, default: Date.now },
  confirmedAt: { type: Date },
  shippedAt: { type: Date },
  deliveredAt: { type: Date },
  cancelledAt: { type: Date }

});

module.exports = mongoose.model("Order", orderSchema);
