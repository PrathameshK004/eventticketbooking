const mongoose = require('mongoose');

const rewardSchema = new mongoose.Schema({
    type: { type: String, enum: ['win', 'lose'], required: true },
    amount: { type: Number, required: true },
    isRevealed: { type: Boolean, required: true, default: false }, //reddemed to wallet
    isRedeemed: { type: Boolean, required: true, default: false },
    userId: { type: String, required: true },
    issuedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date }
});

const Reward = mongoose.model('Reward', rewardSchema);
module.exports = Reward;

