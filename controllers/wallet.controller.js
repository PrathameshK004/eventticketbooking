const Wallet = require('../modules/wallet.module.js');
const User = require('../modules/user.module.js');
const nodemailer = require('nodemailer');

module.exports = {
    getWalletBalance: getWalletBalance,
    updateWallet: updateWallet,
    deleteWallet: deleteWallet,
    transferToBank: transferToBank
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



async function transferToBank(req, res) {
    try {
        const userId = req.params.userId;
        const { bankAccount, ifscCode } = req.body;

        if (!bankAccount || !ifscCode) {
            return res.status(400).json({ message: "Bank account details and IFSC code are required." });
        }

        // Fetch user wallet
        let wallet = await Wallet.findOne({ userId });
        if (!wallet || wallet.balance <= 0) {
            return res.status(400).json({ message: "Insufficient balance." });
        }

        // Amount to transfer is the entire balance in the wallet
        const transferAmount = wallet.balance;

        // Fetch the user details (email) using userId
        const user = await User.findOne({ _id: userId });
        if (!user) {
            return res.status(400).json({ message: "User not found." });
        }

        // Deduct entire balance from wallet
        wallet.balance = 0;

        // Add the debit transaction to the transactions array
        wallet.transactions.push({
            amount: transferAmount,
            type: 'Debit',
            description: `Transfer to bank account ${bankAccount} and IFSC ${ifscCode}`,
            date: new Date()
        });

        // Save the updated wallet
        await wallet.save();

        // Create Nodemailer transporter
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL,
                pass: process.env.EMAIL_PASSWORD
            }
        });

        // Function to mask the last 4 digits of a string (account or IFSC code)
        function maskLast4Digits(value) {
            return value.slice(0, -4) + "XXXX";
        }

        // Mask the account number and IFSC code
        const maskedBankAccount = maskLast4Digits(bankAccount);
        const maskedIfscCode = maskLast4Digits(ifscCode);

        const mailOptions = {
            from: process.env.EMAIL,
            to: user.emailID,
            subject: 'Wallet Transfer Confirmation',
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border-radius: 8px; background-color: #f9f9f9; border: 1px solid #ddd;">
            
            <!-- Header Section -->
            <div style="text-align: center; background-color: #030711; padding: 15px; border-radius: 8px 8px 0 0;">
                <img src="https://i.imgur.com/sx36L2V.png" alt="EventHorizon Logo" style="max-width: 80px;">
                <h2 style="color: #ffffff; margin: 10px 0;">Wallet Transfer Confirmation</h2>
            </div>

            <!-- Transfer Details -->
            <div style="background-color: #ffffff; padding: 20px; border-radius: 0 0 8px 8px;">
                <p style="font-size: 16px;">Dear <strong>${user.userName}</strong>,</p>
                <p>We are pleased to confirm the successful transfer of your entire wallet balance of Rs. ${transferAmount}.</p>
                
                <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin-top: 10px; text-align: center;">
                    <h3 style="color: #333;">Transfer Details</h3>
                    <p><strong>Bank Account:</strong> ${maskedBankAccount}</p>
                    <p><strong>IFSC Code:</strong> ${maskedIfscCode}</p>
                </div>

                <h3 style="color: #0078ff; margin-top: 20px;">Transaction Information</h3>
                <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                    <tr>
                        <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Transaction ID:</strong></td>
                        <td style="padding: 8px; border-bottom: 1px solid #ddd;">TXN${wallet.transactions[wallet.transactions.length - 1]._id}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Amount Transferred:</strong></td>
                        <td style="padding: 8px; border-bottom: 1px solid #ddd;">Rs. ${transferAmount}</td>
                    </tr>
                </table>

                <p style="text-align: center; color: gray; font-size: 12px; margin-top: 20px;">
                    Thank you for using EventHorizon!<br>Best Regards, <br>EventHorizon Team
                </p>
            </div>

            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">

            <!-- Footer -->
            <p style="color: gray; font-size: 12px; text-align: center;">This is an autogenerated message. Please do not reply to this email.</p>
        </div>
    `
        };


        await transporter.sendMail(mailOptions);

        return res.status(200).json({
            message: "Transfer successful. Confirmation email sent."
        });
    } catch (error) {
        console.error("Transfer error:", error);
        res.status(500).json({ message: "Internal Server Error." });
    }
};
