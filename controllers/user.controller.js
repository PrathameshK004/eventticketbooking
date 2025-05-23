const Wallet = require('../modules/wallet.module.js');
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../modules/user.module.js');
const Event = require('../modules/event.module.js');
const Enquiry = require('../modules/enquiry.module.js');
const Booking = require('../modules/bookingdetails.module.js');
const Notification = require('../modules/notification.module.js');
const AdminNotification = require('../modules/adminNotification.module.js');
const jwt = require('jsonwebtoken');
const ObjectId = require('mongoose').Types.ObjectId;
const nodemailer = require('nodemailer');
const axios = require('axios');
const bcrypt = require('bcrypt');
const { GridFSBucket } = require("mongodb");

require('dotenv').config();

module.exports = {
    sendOTP,
    validateLogin,
    validateLoginOtp,
    validateLoginGoogle,
    getAllUsers,
    getUserById,
    createUser,
    createTempUser,
    createUserGoogle,
    updateUser,
    deleteUser,
    logoutUser,
    validateAdminLogin,
    makeAdmin,
    removeAdmin,
    getRoles,
    getHoldBalance,
    checkPendingOrgReq,
    checkRemoveOrg,
    removeOrg,
    getOrgs
};

function isUuidValid(userId) {

    return mongoose.Types.ObjectId.isValid(userId);
}

const generateOTP = () => Math.floor(1000 + Math.random() * 9000);


async function sendOTP(req, res) {
    try {
        const { emailID, purpose } = req.body;
        const user = await User.findOne({ emailID });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        if (purpose === "Admin Login" && !user.roles.includes(2)) {
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


async function getAllUsers(req, res) {
    try {
        const users = await User.find({ isTemp: false });

        if (!users || users.length === 0) {
            return res.status(200).json({ message: 'No users found.' });
        }

        // Check roles and events for each user
        const updatedUsers = await Promise.all(users.map(async (user) => {
            const isOrg = user.roles.includes(1);
            const events = isOrg ? await Event.find({ userId: user._id }) : [];
            const hasEvent = events.length > 0;

            return {
                ...user.toObject(),
                isOrg,
                hasEvent
            };
        }));

        res.status(200).json(updatedUsers);

    } catch (err) {
        console.error("Error fetching users:", err.message);
        res.status(500).json({ error: "Failed to fetch users" });
    }
}




async function getRoles(req, res) {
    let userId = req.params.userId;
    try {
        let user = await User.findById(userId);

        if (!user || user.isTemp) {
            return res.status(404).json({ message: "User not found" });
        }
        res.status(200).json(user.roles);
    } catch (err) {
        console.error("Internal server error:", err.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

async function getUserById(req, res) {
    let userId = req.params.userId;

    try {
        let user = await User.findById(userId);

        if (!user || user.isTemp) {
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
        expiresIn: '7d'
    });
}

const createAdminToken = (key) => { // Update to key from id
    return jwt.sign({ key }, process.env.JWTSecret, {
        expiresIn: '2d'
    });
}
async function createUser(req, res) {
    try {

        const { userName, emailID, code } = req.body;
        const tempUser = await User.findOne({ emailID: emailID });
        // Validate OTP
        if (!tempUser.code || tempUser.codeExpiry < Date.now()) {
            return res.status(400).json({ message: "OTP expired. Please request a new one." });
        }

        // Compare the entered code with the hashed code
        const isCodeValid = await bcrypt.compare(code, tempUser.code);
        if (!isCodeValid) {
            return res.status(400).json({ message: "Invalid OTP. Please try again." });
        }

        // OTP is correct, proceed with login

        tempUser.codeExpiry = null;
        tempUser.isTemp = false;

        // Save the user
        await tempUser.save();

        // Create an associated wallet with an initial balance of 0
        const newWallet = new Wallet({
            userId: tempUser._id,  // Link the wallet to the newly created user
            balance: 0,
            transactions: []
        });

        // Save the wallet
        await newWallet.save();


        res.status(201).json({
            userId: tempUser._id,
            userName: tempUser.userName
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
        let newUser;
        const newUserGoogle = req.body;
        newUserGoogle.isGoogle = true;


        newUser = await User.findOne({ emailID: req.body.emailID });

        if (newUser) {

            if (newUser.isTemp) {
                newUser.userName = req.body.userName;
                newUser.isGoogle = true;
                newUser.isTemp = false;
                newUser.imageUrl = req.body.imageUrl;
                newUser.passwordGoogle = req.body.passwordGoogle;
                await newUser.save();
            } else {

                return res.status(400).json({
                    message: "User already exists. Please login with your credentials."
                });
            }
        } else {

            newUser = await User.create(newUserGoogle);
        }

        // Create an associated wallet with an initial balance of 0
        const newWallet = new Wallet({
            userId: newUser._id,  // Link the wallet to the newly created user
            balance: 0,
            transactions: []
        });

        // Save the wallet
        await newWallet.save();

        // Return response with user information
        res.status(201).json({
            userId: newUser._id,
            userName: newUser.userName
        });
    } catch (error) {
        // Handle validation errors
        if (error.name === 'ValidationError') {
            const errorMessages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                message: "Validation error occurred",
                errors: errorMessages
            });
        }

        // Log unexpected errors
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
        user.emailID = updatedUserData.emailID || user.emailID;

        await user.save();

        res.status(200).json(user);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
}


async function createTempUser(req, res) {
    try {
        let tempUser;
        const { userName, emailID } = req.body;
        try {
            const existingUser = await User.findOne({ emailID: emailID });
            if (existingUser && existingUser.isTemp) {
                tempUser = existingUser;
            }
            if (existingUser && !existingUser.isTemp) {
                return res.status(400).json({ error: 'User already exists' });
            }
        } catch (err) {
            return res.status(500).json({ error: 'Error checking for existing user.' });
        }

        // If no temporary user exists, create a new one
        if (!tempUser) {
            tempUser = await User.create(req.body);
            tempUser.isTemp = true;
            await tempUser.save();
        }

        // If the user is created successfully, call the sendOtpSignUp API
        if (tempUser) {
            // Assuming the route is internal and accessible
            await axios.post('https://eventticketbooking-cy6o.onrender.com/api/users/sendOtp', { emailID: tempUser.emailID, purpose: "Sign Up" });
            return res.status(200).json({ message: "Temp user created and OTP sent." });
        } else {
            return res.status(400).json({ message: "Failed to create temp user." });
        }
    } catch (error) {
        console.error("Error creating temp user or sending OTP:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};

async function deleteUser(req, res) {
    const userId = req.params.userId;
    const objectId = new mongoose.Types.ObjectId(userId);

    try {
        // Delete the user
        const user = await User.findByIdAndDelete(userId);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // Get database connection
        const db = mongoose.connection.db;

        // Setup GridFS buckets
        const eventBucket = new GridFSBucket(db, { bucketName: "uploads" });
        const enquiryBucket = new GridFSBucket(db, { bucketName: "enquiryUploads" });

        // Fetch fileIds from Event and Enquiry collections
        const eventUploads = await Event.find({ userId }, "fileId").lean();
        const enquiryUploads = await Enquiry.find({ userId: objectId }, "fileId").lean();

        // Filter out documents
        const eventFileIds = eventUploads.map(event => new mongoose.Types.ObjectId(event.fileId));

        const enquiryFileIds = enquiryUploads
            .filter(enquiry => enquiry.fileId) // Keep only valid fileIds
            .map(enquiry => new mongoose.Types.ObjectId(enquiry.fileId));

        // Delete files from GridFS
        const deleteEventFiles = eventFileIds.map(fileId => eventBucket.delete(fileId));
        const deleteEnquiryFiles = enquiryFileIds.map(fileId => enquiryBucket.delete(fileId));

        // Execute all delete operations in parallel
        await Promise.all([
            Wallet.findOneAndDelete({ userId }),
            Event.deleteMany({ userId }),
            Enquiry.deleteMany({ userId: objectId }),
            Notification.deleteMany({ userId: objectId }),
            Booking.deleteMany({ userId }),
            AdminNotification.deleteMany({ userId }),
            Promise.all(deleteEventFiles), // Delete event files from GridFS
            Promise.all(deleteEnquiryFiles) // Delete enquiry files from GridFS
        ]);

        return res.status(204).end(); // No content
    } catch (err) {
        console.error("Error deleting user:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}


async function validateLogin(req, res) {
    try {
        const { emailID, code } = req.body;
        const user = await User.findOne({ emailID });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        if (user.isTemp) {
            return res.status(404).json({ message: "User not found" });
        }

        // Validate OTP
        if (!user.code || user.codeExpiry < Date.now()) {
            return res.status(400).json({ message: "OTP expired. Please request a new one." });
        }

        // Compare the entered code with the hashed code
        const isCodeValid = await bcrypt.compare(code, user.code);
        if (!isCodeValid) {
            return res.status(400).json({ message: "Invalid OTP. Please try again." });
        }

        // OTP is correct, proceed with login

        user.codeExpiry = null;
        await user.save();

        const token = createToken(user._id); // Ensure this is based on user._id
        res.cookie('jwt', token, {
            httpOnly: true,
            secure: true,
            sameSite: 'None',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });
        res.status(200).json({
            userId: user._id,
            user: user.userName,
            roles: user.roles
        });

    } catch (error) {
        console.error("Admin Login Error:", error.message);
        res.status(500).json({ message: "Internal Server Error", error });
    }
};

async function validateLoginOtp(req, res) {
    try {
        const { emailID, purpose } = req.body;

        const user = await User.findOne({ emailID });

        if (!user || user.isTemp) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // Send OTP request to the external service
        try {
            const response = await axios.post('https://eventticketbooking-cy6o.onrender.com/api/users/sendOtp', { emailID, purpose });
            return res.status(200).json({ message: "OTP sent successfully." });
        } catch (error) {
            console.error("Error from external OTP service:", error.message || error);
            return res.status(500).json({ message: "Error while sending OTP to external service." });
        }

    } catch (error) {
        console.error("Error in validateLoginOtp:", error.message || error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
}




async function validateLoginGoogle(req, res) {
    const { emailID, password } = req.body;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    try {
        let user;
        let checkGoogleUser = await User.findOne({ emailID: emailID });

        if (checkGoogleUser && !checkGoogleUser.isGoogle && !checkGoogleUser.isTemp) {
            checkGoogleUser.passwordGoogle = password;
            checkGoogleUser.isGoogle = true;
            await checkGoogleUser.save();
        }

        if (checkGoogleUser && checkGoogleUser.isTemp) {
            return res.status(404).json({ message: "User not found" });
        }

        if (emailRegex.test(emailID)) {
            user = await User.loginWithGoogle(emailID, password);
        } else {
            return res.status(400).json({ message: 'Invalid email format' });
        }

        const token = createToken(user._id); // Ensure this is based on user._id
        res.cookie('jwt', token, {
            httpOnly: true,
            secure: true,
            sameSite: 'None', // Allows cross-origin requests
            maxAge: 7 * 24 * 60 * 60 * 1000
        });
        res.status(200).json({
            userId: user._id,
            user: user.userName,
            roles: user.roles
        });

    } catch (err) {
        console.error("Login Error: ", err.message || err);
        res.status(400).json({ message: err.message || 'Invalid email or password' });
    }
}


function logoutUser(req, res) {
    res.cookie('jwt', '', {
        httpOnly: true,
        secure: true,
        sameSite: 'None',
        expires: new Date(0) // Set the expiration date to 1970 (Unix)
    });
    res.status(200).json({ message: 'Successfully logged out' }); // Send success message
}


async function validateAdminLogin(req, res) {
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

        // Compare the entered code with the hashed code
        const isCodeValid = await bcrypt.compare(code, user.code);
        if (!isCodeValid) {
            return res.status(400).json({ message: "Invalid OTP. Please try again." });
        }

        // OTP is correct, proceed with login

        user.codeExpiry = null;
        await user.save();

        const token = createAdminToken(user._id); // Ensure this is based on user._id
        res.cookie('jwt', token, {
            httpOnly: true,
            secure: true,
            sameSite: 'None',
            maxAge: 2 * 24 * 60 * 60 * 1000
        });
        res.status(200).json({
            userId: user._id,
            user: user.userName,
            roles: user.roles
        });

    } catch (error) {
        console.error("Admin Login Error:", error.message);
        res.status(500).json({ message: "Internal Server Error", error });
    }
};


async function makeAdmin(req, res) {
    const userId = req.params.userId;
    const { adminUserId } = req.body;
    try {
        const user = await User.findById(userId);
        const adminUser = await User.findById(adminUserId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (!adminUser) {
            return res.status(404).json({ message: 'Admin User not found' });
        }

        if (!adminUser.roles.includes(2)) {
            return res.status(403).json({ message: 'You are not authorized to update this user, You are not Admin' })
        }

        if (user.roles.includes(2)) {
            return res.status(400).json({ message: 'The User is already an Admin' })
        }

        user.roles.addToSet(2);
        await user.save();

        return res.status(200).json({ message: 'User has been updated successfully to Admin' });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Server error, please try again later' });
    }
}


async function removeAdmin(req, res) {
    const userId = req.params.userId;
    const { adminUserId } = req.body;

    try {

        if (userId === adminUserId) {
            return res.status(400).json({ message: "You cannot remove yourself as an Admin." });
        }

        const user = await User.findById(userId);
        const adminUser = await User.findById(adminUserId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (!adminUser) {
            return res.status(404).json({ message: 'Admin User not found' });
        }

        if (!adminUser.roles.includes(2)) {
            return res.status(403).json({ message: 'You are not authorized to update this user, You are not Admin' });
        }

        if (!user.roles.includes(2)) {
            return res.status(403).json({ message: 'The User is already NOT an Admin' });
        }

        user.roles.pull(2);

        await user.save();

        return res.status(200).json({ message: 'User has been successfully updated and removed as Admin' });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Server error, please try again later' });
    }
}


async function getHoldBalance(req, res) {
    try {
        const userId = req.params.userId;

        if (!userId || !isUuidValid(userId)) {
            return res.status(400).json({ error: 'User ID is required and must be a valid UUID.' });
        }

        const user = await User.findById(userId);
        if (!user || user.isTemp) {
            return res.status(400).json({ error: 'User not Found.' });
        }

        if (!user.roles.includes(1)) {
            return res.status(403).json({ error: 'You are not an Organizer.' });
        }

        const events = await Event.find({ userId });

        if (!events.length) {
            return res.status(404).json({ error: 'No events found for the given User ID.' });
        }

        const totalHoldBalance = events.reduce((sum, event) => sum + (event.holdAmount || 0), 0).toFixed(2);

        res.status(200).json({ holdBalance: totalHoldBalance });
    } catch (error) {
        res.status(500).json({ error: 'An error occurred while fetching the hold balance: ' + error.message });
    }
}
async function checkPendingOrgReq(req, res) {
    const userId = req.params.userId;
    try {
        const enquiries = await Enquiry.find({
            userId: userId,
            type: "Organizer Request",
            status: "Pending"
        });

        if (enquiries.length > 0) {
            return res.status(200).json({ success: true });
        }

        return res.status(404).json({ success: false, message: "No pending Organizer Requests found." });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: "Server error occurred." });
    }
}

async function checkRemoveOrg(req, res) {
    const userId = req.params.userId;
    try {
        const events = await Event.find({ userId: userId }); // Filter events by userId (organizer)

        const user = await User.findById(userId);

        if (!user.roles.includes(1)) {
            return res.status(200).json({ success: false, message: "User is not an Organizer." });
        }

        if (events.length <= 0 && user.roles.includes(1)) {
            return res.status(200).json({ success: true, message: "No events found for this organizer." });
        }

        return res.status(200).json({ success: false, message: "Events found for this organizer." });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: "Server error occurred." });
    }
}

async function removeOrg(req, res) {
    const userId = req.params.userId;

    try {

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (Array.isArray(user.eventId) && user.eventId.length > 0) {
            return res.status(400).json({ message: 'User has events, cannot change the role' });
        }

        if (!user.roles.includes(1)) {
            return res.status(403).json({ message: 'User is not an Organizer' });
        }

        user.roles.pull(1);

        await user.save();

        return res.status(200).json({ message: 'User has been successfully updated and removed as Organizer' });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Server error, please try again later' });
    }
}


async function getOrgs(req, res) {
    try {
        const searchQuery = req.query.search;

        const query = { roles: { $in: [1] } };

        if (!searchQuery) {
            const users = await User.find(query, { userName: 1, emailID: 1, _id: 0 });
            return res.json(users);
        }

        query.$or = [
            { userName: { $regex: searchQuery, $options: 'i' } },
            { emailID: { $regex: searchQuery, $options: 'i' } }
        ];

        const users = await User.find(query, { userName: 1, emailID: 1, _id: 0 });

        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
}
