const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({

  // 🛒 MULTIPLE PRODUCTS IN ONE ORDER
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

  // 👤 USER DETAILS
  name: {
    type: String,
    required: true
  },
  mobile: {
    type: String,
    required: true
  },

  // 📍 DELIVERY ADDRESS
  pincode: {
    type: String,
    required: true
  },
  state: {
    type: String,
    required: true
  },
  city: {
    type: String,
    required: true
  },
  locality: {
    type: String,
    required: true
  },
  house: {
    type: String,
    required: true
  },
  landmark: {
    type: String
  },

  // 🔐 OTP VERIFICATION
  isVerified: {
    type: Boolean,
    default: false
  },

  // 💳 PAYMENT METHOD
  paymentMethod: {
    type: String,
    enum: ["Cash on Delivery", "Online"],
    default: "Cash on Delivery"
  },

  // 📦 ORDER STATUS
  status: {
    type: String,
    enum: ["Pending", "Confirmed", "Cancelled", "Delivered"],
    default: "Pending"
  },

  // 🕒 DATE
  orderDate: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Order", orderSchema);
