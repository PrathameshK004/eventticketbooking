const mongoose = require('mongoose');
const Wallet = require('../modules/wallet.module.js');
const User = require('../modules/user.module.js');

// Export functions
module.exports = {
    validateUserWallet,
    validateUpdateWallet
};

// Validate that the user has a wallet and exists
async function validateUserWallet(req, res, next) {
    const userId = req.user.key;

    if (!userId || !isUuidValid(userId)) {
        return res.status(400).json({ error: 'User ID is required and must be a valid UUID.' });
    }

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found in the database.' });
        }

        const wallet = await Wallet.findOne({ userId });
        if (!wallet) {
            return res.status(404).json({ error: 'Wallet not found for the user.' });
        }

        req.wallet = wallet; // Add wallet to request object for further use
        next();
    } catch (error) {
        res.status(500).json({ error: 'An error occurred while validating the user wallet. ' + error });
    }
}

// Validate and check conditions for updating the wallet (credit/debit)
async function validateUpdateWallet(req, res, next) {
    const { amount, type, description } = req.body;

    // Ensure amount is provided and valid
    if (!amount || amount <= 0) {
        return res.status(400).json({ error: 'Invalid amount. It should be a positive number.' });
    }

    // Ensure wallet exists in the request
    if (!req.wallet) {
        return res.status(400).json({ error: 'User wallet not found. Please ensure wallet is initialized.' });
    }

    // Check if sufficient balance for debit
    if (type === 'Debit' && req.wallet.balance < amount) {
        return res.status(400).json({ error: 'Insufficient balance for debit.' });
    }

    // Proceed with the next middleware
    next();
}

// Utility function to validate UUID format (can be used for other validations)
function isUuidValid(id) {
    return mongoose.Types.ObjectId.isValid(id);
}
