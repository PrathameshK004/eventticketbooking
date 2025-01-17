const mongoose = require('mongoose');

const WalletSchema = new mongoose.Schema({
    userId: { type: String, required: true},
    balance: { type: Number, default: 0 },
    transactions: [
        {
            amount: Number,
            type: { type: String, enum: ['Credit', 'Debit'], required: true },
            description: String,
            date: { type: Date, default: Date.now }
        }
    ]
});

module.exports = mongoose.model('Wallet', WalletSchema);
