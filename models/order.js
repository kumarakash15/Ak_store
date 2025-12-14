const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Listing",
    required: true
  },
  quantity: {
    type: Number,
    required: true
  },

  // USER DETAILS
  name: String,
  mobile: String,

  // ADDRESS
  pincode: String,
  state: String,
  city: String,
  locality: String,
  house: String,
  landmark: String,

  // OTP
  isVerified: {
    type: Boolean,
    default: false
  },

  // PAYMENT
  paymentMethod: {
    type: String,
    default: "Cash on Delivery"
  },

  // ✅ ORDER STATUS
  status: {
    type: String,
    enum: ["Pending", "Confirmed", "Cancelled"],
    default: "Pending"
  },

  orderDate: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Order", orderSchema);