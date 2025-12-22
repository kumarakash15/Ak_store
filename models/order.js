const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({

  // 👤 LINK ORDER TO USER
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  // 🛒 MULTIPLE PRODUCTS
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
  name: String,
  mobile: String,

  // 📍 ADDRESS
  pincode: String,
  state: String,
  city: String,
  locality: String,
  house: String,
  landmark: String,

  // 🔐 OTP
  isVerified: {
    type: Boolean,
    default: false
  },

  // 💳 PAYMENT
  paymentMethod: {
    type: String,
    enum: ["Cash on Delivery", "Online"],
    default: "Cash on Delivery"
  },

  // 📦 STATUS
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