const mongoose = require('mongoose');
const Schema = mongoose.Schema;
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
const Listing = mongoose.model("Listing", ListingSchema);
module.exports = Listing;