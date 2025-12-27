const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  orderId: {
    type: String,
    required: true,
    unique: true
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
  name: String,
  mobile: String,
  pincode: String,
  state: String,
  city: String,
  locality: String,
  house: String,
  landmark: String,
  isVerified: { type: Boolean, default: false },
  paymentMethod: { type: String, enum: ["Cash on Delivery", "Online"], default: "Cash on Delivery" },
  status: { type: String, enum: ["Pending", "Confirmed", "Cancelled", "Delivered"], default: "Pending" },
  orderDate: { type: Date, default: Date.now },
  confirmedAt: { type: Date },
  shippedAt: { type: Date },
  deliveredAt: { type: Date },
  cancelledAt: { type: Date }
});

module.exports = mongoose.model("Order", orderSchema);