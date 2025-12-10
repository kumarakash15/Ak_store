const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// LISTING SCHEMA
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

// CART SCHEMA
const cartSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Listing",
    required: true
  },
  quantity: {
    type: Number,
    default: 1
  },
  userId: {
    type: String,
    default: "guest"
  }
});

// MODELS
const Listing = mongoose.model("Listing", ListingSchema);
const Cart = mongoose.model("Cart", cartSchema);

// EXPORT BOTH MODELS
module.exports = { Listing, Cart };
