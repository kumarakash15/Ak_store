const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/* =====================
   LISTING SCHEMA
===================== */
const ListingSchema = new Schema({
  image: {
    type: String,
    required: true
  },
  company: {
    type: String,
    required: true
  },
  item_name: {
    type: String,
    required: true
  },
  original_price: {
    type: Number,
    required: true
  },
  current_price: {
    type: Number,
    required: true
  },
  discount_percentage: {
    type: Number,
    default: 0
  },
  return_period: {
    type: Number,
    default: 0
  },
  delivery_date: {
    type: String,
    required: true
  },
  rating: {
    stars: {
      type: Number,
      default: 0
    },
    count: {
      type: Number,
      default: 0
    }
  }
});

/* =====================
   CART SCHEMA (FIXED)
===================== */
const cartSchema = new Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Listing",
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  quantity: {
    type: Number,
    default: 1
  }
});

/* =====================
   MODELS
===================== */
const Listing = mongoose.model("Listing", ListingSchema);
const Cart = mongoose.model("Cart", cartSchema);

module.exports = { Listing, Cart };