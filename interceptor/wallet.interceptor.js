const mongoose = require('mongoose');
const Wallet = require('../modules/wallet.module.js');
const jwt = require('jsonwebtoken');
const User = require('../modules/user.module.js');

// Export functions
module.exports = {
    validateUserWallet,
    validateUpdateWallet,
    validateTransferToBank,
    validateAdminWallet
};

// Validate that the user has a wallet and exists
async function validateUserWallet(req, res, next) {
     let userId = req.params.userId;

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


async function validateAdminWallet(req, res, next) {
    try {
        const adminWalletId = process.env.ADMIN_WALLET_ID;
        if (!adminWalletId) {
            return res.status(500).json({ error: "Admin wallet ID is not set in the environment." });
        }

        // Find admin wallet
        const wallet = await Wallet.findById(adminWalletId);
        if (!wallet) {
            return res.status(404).json({ error: "Admin wallet not found." });
        }
        req.wallet = wallet; 

        const token = req.cookies.jwt;
        if (!token) {
            return res.status(403).json({ message: "No token provided, access denied!" });
        }

        // Verify the JWT token
        jwt.verify(token, process.env.JWTSecret, async (err, decoded) => {
            if (err) {
                return res.status(401).json({ message: "Unauthorized! Invalid token." });
            }

            try {
                let user = await User.findById(decoded.key);
                if (!user) {
                    return res.status(404).json({ message: "User not found" });
                }
                if (!user.roles.includes(2)) {
                    return res.status(403).json({ message: "User is not Admin" });
                }
                next(); 
            } catch (error) {
                return res.status(500).json({ message: "Error fetching user", error: error.message });
            }
        });

    } catch (error) {
        return res.status(500).json({ error: "An error occurred", details: error.message });
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

async function validateTransferToBank(req, res, next) {
    const { bankAccount, ifscCode } = req.body;

    // Bank account regex: Only numbers, 9 to 18 digits long
    const bankAccountRegex = /^[0-9]{9,18}$/;

    // IFSC code regex: 4 alphabets, followed by a 0, and then 6 digits
    const ifscCodeRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;

    // Check if bankAccount is provided and matches the regex
    if (!bankAccount || !bankAccountRegex.test(bankAccount)) {
        return res.status(400).json({ message: "Invalid bank account details." });
    }

    // Check if ifscCode is provided and matches the regex
    if (!ifscCode || !ifscCodeRegex.test(ifscCode)) {
        return res.status(400).json({ message: "Invalid IFSC code." });
    }

    next();
}
