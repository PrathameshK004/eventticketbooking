const Wallet = require('../modules/wallet.module.js');

module.exports = {
    getWalletBalance: getWalletBalance,
    updateWallet: updateWallet,
    deleteWallet: deleteWallet
};

// Get Wallet Balance
async function getWalletBalance(req, res) {
    try {
        const wallet = req.wallet; // Access the wallet from the validated request

        if (!wallet) {
            return res.status(404).json({ error: 'Wallet not found for the user.' });
        }

        return res.status(200).json({ wallet });
    } catch (err) {
        return res.status(500).json({ error: 'Internal server error ' + err });
    }
}

// Update Wallet (Credit/Debit)
async function updateWallet(req, res) {
    const { amount, type, description } = req.body;
    const wallet = req.wallet; // Access the wallet from the validated request

    try {
        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Invalid amount. It should be a positive number.' });
        }

        if (type === 'Debit' && wallet.balance < amount) {
            return res.status(400).json({ error: 'Insufficient balance for debit.' });
        }

        // Update wallet balance
        wallet.balance += type === 'Credit' ? amount : -amount;
        wallet.transactions.push({ amount, type, description });

        await wallet.save();

        return res.status(200).json({ message: 'Wallet updated successfully', balance: wallet.balance });
    } catch (err) {
        return res.status(500).json({ error: 'Internal server error ' + err });
    }
}

// Delete Wallet
async function deleteWallet(req, res) {
    const wallet = req.wallet; // Access the wallet from the validated request

    try {
        if (!wallet) {
            return res.status(404).json({ error: 'Wallet not found for the user.' });
        }

        await Wallet.findOneAndDelete({ userId: wallet.userId });

        return res.status(204).end();
    } catch (err) {
        return res.status(500).json({ error: 'Internal server error ' + err });
    }
}
