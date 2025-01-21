const Wallet = require('../modules/wallet.module.js');
const express = require('express');
const router = express.Router();
const User = require('../modules/user.module.js');
const jwt = require('jsonwebtoken');
const ObjectId = require('mongoose').Types.ObjectId;
const nodemailer = require('nodemailer');

require('dotenv').config();

module.exports = {
    sendOTP,
    validateLogin,
    validateLoginGoogle,
    getAllUsers,
    getUserById,
    createUser,
    createUserGoogle,
    updateUser,
    deleteUser,
    logoutUser,
    validateAdminLogin,
    forgotPassword
};

const generateOTP = () => Math.floor(1000 + Math.random() * 9000);


async function sendOTP(req, res) {
    try {
        const { emailID, purpose } = req.body;
        const user = await User.findOne({ emailID });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        if (purpose === "AdminLogin" && !user.roles.includes(2)) {
            return res.status(403).json({ message: "Access denied! Admins only." });
        }

        const otp = generateOTP();
        user.code = otp;
        user.codeExpiry = Date.now() + 5 * 60 * 1000;
        await user.save();

        // Nodemailer Transporter Setup
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL,
                pass: process.env.EMAIL_PASSWORD
            }
        });

        const mailOptions = {
            from: process.env.EMAIL,
            to: emailID,
            subject: `Your OTP for ${purpose}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; padding: 20px; border-radius: 8px; background-color: #f9f9f9; border: 1px solid #ddd;">
                    
                    <!-- Header Section -->
                    <div style="text-align: center; background-color: #030711; padding: 15px; border-radius: 8px 8px 0 0;">
                        <img src="https://i.imgur.com/sx36L2V.png" alt="EventHorizon Logo" style="max-width: 80px;">
                        <h2 style="color: #ffffff; margin: 10px 0;">OTP Verification</h2>
                    </div>
        
                    <!-- OTP Message -->
                    <div style="background-color: #ffffff; padding: 20px; border-radius: 0 0 8px 8px; text-align: center;">
                        <p style="font-size: 16px;">Dear <strong>${user.userName}</strong>,</p>
                        <p>Your OTP for <strong>${purpose}</strong> is:</p>
                        
                        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin-top: 10px; text-align: center;">
                            <h2 style="color: #030711; font-size: 24px; margin: 0;">${otp}</h2>
                            <p style="margin-top: 5px; color: red;">This OTP expires in 5 minutes.</p>
                        </div>
        
                        <p style="text-align: center; color: gray; font-size: 12px; margin-top: 20px;">
                            If you did not request this OTP, please ignore this email.<br>
                            Thank you, <br>EventHorizon Team
                        </p>
                    </div>
        
                    <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
        
                    <!-- Footer -->
                    <p style="color:gray; font-size:12px; text-align: center;">This is an autogenerated message. Please do not reply to this email.</p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        res.status(200).json({ message: "OTP sent successfully" });

    } catch (error) {
        console.error("OTP Error:", error.message);
        res.status(500).json({ message: "Internal Server Error", error });
    }
};


function getAllUsers(req, res) {
    User.find()
        .then(users => res.status(200).json(users))
        .catch(err => {
            console.error(err.message);
            res.status(500).json({ error: 'Failed to fetch users' });
        });
}

async function getUserById(req, res) {
    let userId = req.params.userId;
    
    try {
        let user = await User.findById(userId);
        
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.status(200).json(user);
    } catch (err) {
        console.error("Internal server error:", err.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

const createToken = (key) => { // Update to key from id
    return jwt.sign({ key }, process.env.JWTSecret, {
        expiresIn: 2 * 60 * 60
    });
}

async function createUser(req, res) {
    try {
        const newUser = await User.create(req.body);
        // Create an associated wallet with an initial balance of 0
        const newWallet = new Wallet({
            userId: newUser._id,  // Link the wallet to the newly created user
            balance: 0,
            transactions: []
        });

        // Save the wallet
        await newWallet.save();
       

        res.status(201).json({
            userId: newUser._id, 
            userName: newUser.userName
        });
    } catch (error) {
        if (error.name === 'ValidationError') {
            const errorMessages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                message: "Validation error occurred",
                errors: errorMessages 
            });
        }
        console.error(error.message);
        res.status(500).json({ message: "Internal server error" });
    }
}

async function createUserGoogle(req, res) {
    try {

        const newUserGoogle=req.body;
        newUserGoogle.isGoogle=true;

        const newUser = await User.create(newUserGoogle);
        // Create an associated wallet with an initial balance of 0
        const newWallet = new Wallet({
            userId: newUser._id,  // Link the wallet to the newly created user
            balance: 0,
            transactions: []
        });

        // Save the wallet
        await newWallet.save();
        

        res.status(201).json({
            userId: newUser._id, 
            userName: newUser.userName
        });
    } catch (error) {
        if (error.name === 'ValidationError') {
            const errorMessages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                message: "Validation error occurred",
                errors: errorMessages 
            });
        }
        console.error(error.message);
        res.status(500).json({ message: "Internal server error" });
    }
}


async function updateUser(req, res) {
    const userId = req.params.userId; 
    const updatedUserData = req.body; 
    try {
        const user = await User.findById(userId); 

        if (!user) {
            return res.status(404).json({ error: 'User not found' }); 
        }

        user.userName = updatedUserData.userName || user.userName;
        user.mobileNo = updatedUserData.mobileNo || user.mobileNo;
        user.emailID = updatedUserData.emailID || user.emailID;
        user.password = updatedUserData.password || user.password;

        await user.save();

        res.status(200).json(user); 
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
}

async function deleteUser(req, res) {
    const userId = req.params.userId; 

    try {
        const user = await User.findByIdAndDelete(userId);
        await Wallet.findOneAndDelete({ userId: userId });
        if (!user) {
            return res.status(404).json({ error: 'User not found' }); 
        }

        return res.status(204).end(); 
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Internal server error' }); 
    }
}

async function validateLogin(req, res) {
    const { mobile_email, password } = req.body;
  
    const mobileRegex = /^[0-9]{10}$/;        
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
    try {
        let user;

        if (mobileRegex.test(mobile_email)) {
            user = await User.loginWithMobile(mobile_email, password);
        } else if (emailRegex.test(mobile_email)) {
            user = await User.loginWithEmail(mobile_email, password);
        } else {
            return res.status(400).json({ message: 'Invalid mobile number or email format' });
        }

        const token = createToken(user._id); // Ensure this is based on user._id
        res.cookie('jwt', token, { 
            httpOnly: true, 
            secure: true, 
            sameSite: 'None', // Allows cross-origin requests
            maxAge: 2 * 60 * 60 * 1000 
        });
        res.status(200).json({ 
            userId: user._id,
            user: user.userName 
        });

    } catch (err) {
        console.error("Login Error: ", err.message || err);
        res.status(400).json({ message: err.message || 'Invalid mobile number/email or password' });
    }
}


async function validateLoginGoogle(req, res) {
    const { mobile_email, password } = req.body;
  
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
    try {
        let user;

        if (emailRegex.test(mobile_email)) {
            user = await User.loginWithGoogle(mobile_email, password);
        } else {
            return res.status(400).json({ message: 'Invalid email format' });
        }

        const token = createToken(user._id); // Ensure this is based on user._id
        res.cookie('jwt', token, { 
            httpOnly: true, 
            secure: true, 
            sameSite: 'None', // Allows cross-origin requests
            maxAge: 2 * 60 * 60 * 1000 
        });
        res.status(200).json({ 
            userId: user._id,
            user: user.userName 
        });

    } catch (err) {
        console.error("Login Error: ", err.message || err);
        res.status(400).json({ message: err.message || 'Invalid mobile number/email or password' });
    }
}


function logoutUser(req, res) {
    res.cookie('jwt', '', { 
        httpOnly: true, 
        secure: true, 
        sameSite: 'None', 
        expires: new Date(0) // Set the expiration date to 1970 (Unix epoch)
    });
    res.status(200).json({ message: 'Successfully logged out' }); // Send success message
}

async function validateAdminLogin(req, res){
    try {
        const { emailID, code } = req.body;
        const user = await User.findOne({ emailID });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        if (!user.roles.includes(2)) {
            return res.status(403).json({ message: "Access denied! Admins only." });
        }

        // Validate OTP
        if (!user.code || user.codeExpiry < Date.now()) {
            return res.status(400).json({ message: "OTP expired. Please request a new one." });
        }

        if (user.code !== code) {
            return res.status(400).json({ message: "Invalid OTP. Please try again." });
        }

        // OTP is correct, proceed with login
        user.code = null; 
        user.codeExpiry = null;
        await user.save();

        const token = createToken(user._id); // Ensure this is based on user._id
        res.cookie('jwt', token, { 
            httpOnly: true, 
            secure: true, 
            sameSite: 'None',
            maxAge: 2 * 60 * 60 * 1000 
        });
        res.status(200).json({ 
            userId: user._id,
            user: user.userName 
        });

    } catch (error) {
        console.error("Admin Login Error:", error.message);
        res.status(500).json({ message: "Internal Server Error", error });
    }
};


async function forgotPassword(req, res){
    const { emailID, code, newPassword } = req.body;
  
    try {

      const user = await User.findOne({ emailID });
  
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
  
     
      // Validate OTP
      if (!user.code || user.codeExpiry < Date.now()) {
        return res.status(400).json({ message: "OTP expired. Please request a new one." });
    }

    if (user.code !== code) {
        return res.status(400).json({ message: "Invalid OTP. Please try again." });
    }

    // OTP is correct, proceed with login
    user.code = null; 
    user.codeExpiry = null;
    
      user.password = newPassword;
      await user.save();
  
      return res.status(200).json({ message: 'Password has been reset successfully' });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Server error, please try again later' });
    }
  };