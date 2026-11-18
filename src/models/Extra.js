const mongoose = require('mongoose');
const { EXTRA_CATEGORIES } = require('./User');

const ExtraSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Extra name is required'],
      trim: true
    },
    category: {
      type: String,
      enum: EXTRA_CATEGORIES,
      default: 'coffee'
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price must be positive']
    },
    isAvailable: {
      type: Boolean,
      default: true
    },
    description: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

module.exports = mongoose.model('Extra', ExtraSchema);
