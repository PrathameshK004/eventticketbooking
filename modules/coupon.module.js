const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
    code: { 
        type: String, 
        required: true, 
        unique: true,
        uppercase: true, 
        match: [/^[A-Z0-9]+$/, 'Coupon code must contain only uppercase letters and numbers'] 
    },
  discountPercentage: { type: Number, required: true },
  noOfUses: { type: Number, required: true },
  expirationDate: { type: Date, required: true },
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
  createdAt: { type: Date, default: Date.now },
  eventId: { type: String, required: true }
});

const Coupon = mongoose.model('Coupon', couponSchema);

module.exports = Coupon;
