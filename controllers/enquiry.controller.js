const Enquiry = require('../modules/enquiry.module.js');
const Token = require('../modules/token.module.js');
const User = require('../modules/user.module.js');
const { GridFSBucket } = require('mongodb');
const mongoose = require('mongoose');
const path = require('path');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { MongoClient } = require('mongodb');
const client = new MongoClient(process.env.CONNECTIONSTRING);
let notificationController = require('./notification.controller');

// MongoDB Connection and GridFS setup
let bucket;
const conn = mongoose.connection;
conn.once('open', () => {
    bucket = new GridFSBucket(conn.db, { bucketName: 'enquiryUploads' });
});

// AES Encryption function
function encryptData(buffer) {
    const iv = crypto.randomBytes(16); // Generate a random IV
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(process.env.ENCRYPTION_KEY, 'hex'), iv);

    let encrypted = cipher.update(buffer);
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    // Return IV and encrypted data
    return Buffer.concat([iv, encrypted]);
}

module.exports = {
    sendEnquiry,
    getAllEnquiries,
    respondToEnquiry,
    sendOrgEnquiry,
    getEnquiryByUserId
};

async function sendEnquiry(req, res) {
    try {
        const enquiryDetails = req.body;
        const enquiry = new Enquiry(enquiryDetails);
        await enquiry.save();
        res.status(201).json({ message: 'Enquiry sent successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to send enquiry' });
    }
};


async function getEnquiryByUserId(req, res) {
    try {
        const userId = req.params.userId;

        if (!userId) {
            return res.status(400).json({ error: "User ID is required." });
        }

        const enquiries = await Enquiry.find({ userId });

        if (!enquiries.length) {
            return res.status(404).json({ message: "No enquiries found for this user." });
        }

        res.status(200).json(enquiries);
    } catch (error) {
        console.error("Error fetching enquiries:", error);
        res.status(500).json({ error: "An error occurred while fetching enquiries." });
    }
}

async function sendOrgEnquiry(req, res) {
    try {
        let fileId = null;
        let imageUrl = null;

        const enquiryDetails = {
            userId: req.body.userId,
            type: req.body.type
        };

        const newEnquiry = await Enquiry.create(enquiryDetails);
        if (!newEnquiry || !newEnquiry._id) {
            return res.status(500).json({ error: 'Failed to create event' });
        }

        // Handle file upload if a file is present
        if (req.file) {
            const fileExtension = path.extname(req.file.originalname);
            const newFileName = `${newEnquiry._id}${fileExtension}`;

            // Encrypt the file buffer
            const encryptedBuffer = encryptData(req.file.buffer);

            // Upload the encrypted file to GridFS and get the fileId
            try {
                const fileUploadResult = await new Promise((resolve, reject) => {
                    const uploadStream = bucket.openUploadStream(newFileName, {
                        contentType: req.file.mimetype,
                    });

                    uploadStream.end(encryptedBuffer);

                    uploadStream.on('finish', async (file) => {
                        resolve(file._id);
                    });

                    uploadStream.on('error', (err) => {
                        console.error('Upload failed:', err);
                        reject(err);
                    });
                });

                fileId = fileUploadResult;
                imageUrl = `https://eventticketbooking-cy6o.onrender.com/file/retrieve/enquiryFile/${newFileName}`;

                // Update enquiry with fileId and imageUrl
                newEnquiry.fileId = fileId;
                newEnquiry.imageUrl = imageUrl;
                await newEnquiry.save();
            } catch (uploadError) {
                console.error('Error uploading file:', uploadError);
                return res.status(500).json({ error: 'File upload failed.' });
            }
        }

        // Respond with the created enquiry details
        res.status(201).json(newEnquiry);
    } catch (error) {
        console.error('Error while creating enquiry:', error);
        res.status(500).json({ error: 'Failed to send Enquiry', details: error.message });
    }
}

async function getAllEnquiries(req, res) {
    try {
        const enquiries = await Enquiry.find();
        res.status(200).json(enquiries);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch enquiries' });
    }
};

const createToken = (key) => { // Update to key from id
    return jwt.sign({ key }, process.env.JWTSecret, {
        expiresIn: '1d'
    });
}

async function respondToEnquiry(req, res) {
    try {
        const { status, remarks } = req.body;
        const enquiry = await Enquiry.findById(req.params.enquiryId);
        if (!enquiry) {
            return res.status(404).json({ error: 'Enquiry not found' });
        }

        if (enquiry.status !== 'Pending') {
            return res.status(400).json({ error: 'Only pending enquiries can be updated' });
        }

        if (status === "Accepted" && enquiry.type === "Organizer Request") {
            const user = await User.findById(enquiry.userId);
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            if (user.roles.includes(1)) {
                return res.status(400).json({ message: 'The User is already an Organizer' })
            }

            user.roles.addToSet(1);
            await user.save();

            try {
                await notificationController.sendNotification("enquiry", "Request Approved", "Your Request to become Organizer has been Accepted.", enquiry.userId)
            }
            catch (err) {
                console.error("Failed to create notification:", err);
            }

        }

        if (status === "Accepted" && enquiry.type === "Event Request") {
            const user = await User.findById(enquiry.userId);
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            // Check if the user is an Organizer (role 1)
            if (!user.roles.includes(1)) {
                return res.status(400).json({ message: 'The User is NOT an Organizer' });
            }

            // Generate the JWT token that expires in 1 day (24 hours)
            const token = createToken(user._id);
            await Token.create({ token, userId: user._id, used: false, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) });

            // Create the link for the "Add Event" page with the token
            const addEventLink = `https://eventhorizondashboard.web.app/addevent?token=${token}`;

            // Send email with the generated link
            const transporter = nodemailer.createTransport({
                service: 'gmail', // You can use other services like SendGrid, etc.
                auth: {
                    user: process.env.EMAIL,
                    pass: process.env.EMAIL_PASSWORD,
                },
            });

            const mailOptions = {
                from: process.env.EMAIL,
                to: user.emailID,
                subject: `Add Event Request Link`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border-radius: 8px; background-color: #f9f9f9; border: 1px solid #ddd;">
                        
                        <!-- Header Section -->
                        <div style="text-align: center; background-color: #030711; padding: 15px; border-radius: 8px 8px 0 0;">
                            <img src="https://i.imgur.com/sx36L2V.png" alt="EventHorizon Logo" style="max-width: 80px;">
                            <h2 style="color: #ffffff; margin: 10px 0;">Event Add Dashboard Link</h2>
                        </div>
            
                        <!-- Welcome Message -->
                        <div style="background-color: #ffffff; padding: 20px; border-radius: 0 0 8px 8px;">
                            <p style="font-size: 16px;">Dear <strong>${user.userName}</strong>,</p>
                            <p>Your request to organize an event has been <strong>approved</strong>. You can now access the EventHorizon Dashboard and add your event.</p>
                            
                            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin-top: 10px; text-align: center;">
                                <p>We have provided you with a <strong>temporary access link</strong>, valid for <strong>24 hours</strong>. Use the link below to access the event add dashboard:</p>
                                
                                <a href="${addEventLink}" style="display: inline-block; background-color: #0078ff; color: #ffffff; padding: 10px 20px; border-radius: 5px; text-decoration: none; font-size: 16px; margin-top: 10px;">Add Event</a>
            
                                <p style="color: red; margin-top: 10px;"><strong>Note:</strong> This link expires in 24 hours.</p>
                            </div>
            
                            <p>If you experience any issues, please contact our support team.</p>
            
                            <p style="text-align: center; color: gray; font-size: 12px; margin-top: 20px;">
                                Thank you for using EventHorizon!<br>Best Regards, <br>EventHorizon Team
                            </p>
                        </div>
            
                        <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
            
                        <!-- Footer -->
                        <p style="color:gray; font-size:12px; text-align: center;">This is an autogenerated message. Please do not reply to this email.</p>
                    </div>
                `
            };


            // Send the email
            await transporter.sendMail(mailOptions);
            try {
                await notificationController.sendNotification("enquiry", "Request Approved", "Your Request to Add Event has been Accepted, Please check your mail", enquiry.userId)
            }
            catch (err) {
                console.error("Failed to create notification:", err);
            }

        }


        if (status === "Accepted" && enquiry.type === "Other") {

            const user = await User.findById(enquiry.userId);
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            try {
                await notificationController.sendNotification("enquiry", "Request Approved", `Your request for enquiry "${enquiry.message}" has been accepted.`, enquiry.userId)
            }
            catch (err) {
                console.error("Failed to create notification:", err);
            }

        }

        if (status === "Rejected") {

            const user = await User.findById(enquiry.userId);
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            try {
                await notificationController.sendNotification("enquiry", "Request Rejected", `Your request for enquiry "${enquiry.type}" has been declined.`, enquiry.userId)
            }
            catch (err) {
                console.error("Failed to create notification:", err);
            }


        }

        // Update the enquiry status
        enquiry.status = status;
        enquiry.remarks = remarks;
        
        const enqDel = await enquiry.save();
        if (enqDel.fileId) {
            await bucket.delete(enqDel.fileId);
        }

        enquiry.imageUrl = null;
        enquiry.fileId = null;
        await enquiry.save();

        res.status(200).json({ message: 'Response updated' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update enquiry' });
    }
};
