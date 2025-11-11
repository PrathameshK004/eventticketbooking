const express = require('express');
const router = express.Router();
const Booking = require('../modules/bookingdetails.module.js');
const Event = require('../modules/event.module.js');
const Coupon = require('../modules/coupon.module.js');
const User = require('../modules/user.module.js');
const mongoose = require('mongoose');
const Wallet = require('../modules/wallet.module.js');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const { generateRewardIfEligible } = require('./reward.controller');;
let notificationController = require('./notification.controller');

module.exports = {
    getAllBookings: getAllBookings,
    getBookingById: getBookingById,
    createBooking: createBooking,
    createBookingWithWallet: createBookingWithWallet,
    updateBooking: updateBooking,
    deleteBooking: deleteBooking,
    getUserBookings: getUserBookings,
    getEventBookings: getEventBookings
};

async function getAllBookings(req, res) {
    try {
        const bookings = await Booking.find();
        res.status(200).json(bookings);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch bookings' });
    }
}

async function getBookingById(req, res) {
    const bookingId = req.params.bookingId;

    try {
        const booking = await Booking.findById(bookingId);

        if (!booking) {
            return res.status(404).json({ message: "Booking not found" });
        }

        res.status(200).json(booking);
    } catch (err) {
        res.status(500).json({ message: "Internal Server Error " + err.message });
    }
}


async function createBooking(req, res) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { userId, eventId, noOfPeoples, totalAmount, withAdminAmount, isCoupon, couponCode } = req.body;

        const totalPeople = Array.isArray(noOfPeoples) ? noOfPeoples.reduce((sum, num) => sum + num, 0) : 0;

        const event = await Event.findById(eventId).session(session);
        if (!event) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: "Event not found" });
        }

        if (event.isTemp) {
            await session.abortTransaction();
            session.endSession();
            return res.status(403).json({ error: 'Event is pending and not live for users.' });
        }

        if (isCoupon && couponCode) {
            const coupon = await Coupon.findOne({ code: couponCode }).session(session);

            if (!coupon) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({ error: "Invalid coupon code." });
            }

            if (coupon.eventId !== eventId) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({ error: "Coupon is not valid for this event." });
            }

            if (coupon.status !== 'Active' || coupon.noOfUses <= 0) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({ error: "Coupon is either inactive or has reached its usage limit." });
            }

            if (new Date() > new Date(coupon.expirationDate)) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({ error: "Coupon has expired." });
            }

            coupon.noOfUses -= 1;
            await coupon.save({ session });
        }

        // Atomically update event capacity and total amount
        const updatedEvent = await Event.findOneAndUpdate(
            { _id: eventId, eventCapacity: { $gte: totalPeople } }, // Ensure enough capacity
            { $inc: { eventCapacity: -totalPeople, totalAmount: totalAmount, holdAmount: totalAmount } },
            { new: true, session }
        );

        if (!updatedEvent) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: "Not enough capacity for this booking." });
        }

        // Create booking inside the transaction
        const bookingData = req.body;
        const newBooking = new Booking({ ...bookingData, totalAmount: withAdminAmount, withoutAdminAmount: totalAmount });
        await newBooking.save({ session });

        // Credit 2.5% fee to Admin Wallet
        const adminFee = withAdminAmount - totalAmount; // 2.5% for Admin
        const adminWalletId = process.env.ADMIN_WALLET_ID;
        let adminWallet = await Wallet.findById(adminWalletId).session(session);

        if (!adminWallet) {
            await session.abortTransaction();
            return res.status(404).json({ error: 'Admin wallet not found' });
        }

        adminWallet.balance += adminFee;
        adminWallet.transactions.push({
            amount: adminFee,
            type: 'Credit',
            description: `Commission (Platform Fees) from booking transaction ID: ${newBooking.transactionId}`
        });

        await adminWallet.save({ session });

        // Commit transaction
        await session.commitTransaction();
        session.endSession();

        // Fetch user email (outside transaction)
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Send booking confirmation email
        await sendBookingConfirmationEmail(user.emailID, newBooking, updatedEvent);

        // Send notification (wrap in try-catch to avoid breaking flow)
        try {
            await notificationController.sendNotification(
                "bookings",
                "Booking Confirmed",
                `Your booking for "${updatedEvent.eventTitle}" has been confirmed.`,
                userId
            );
        } catch (err) {
            console.error("Failed to create notification:", err);
        }

        const rewardResult = await generateRewardIfEligible(userId);

        if (rewardResult.success) {
            try {
                await notificationController.sendNotification(
                    "reward",
                    "Reward Earned",
                    `You've earned a reward for your booking. Check your rewards section for details!`,
                    userId
                );
            } catch (err) {
                console.error("Failed to create notification:", err);
            }
        }

        res.status(201).json({
            message: 'Booking successful',
            booking: newBooking,
            reward: rewardResult.success ? rewardResult.reward : rewardResult.message
        });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();

        if (error.name === 'ValidationError') {
            return res.status(400).json({
                message: "Validation error occurred",
                errors: Object.values(error.errors).map(err => err.message),
            });
        }

        res.status(500).json({ message: "Internal server error: " + error.message });
    }
}


async function createBookingWithWallet(req, res) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { userId, eventId, noOfPeoples, totalAmount, withAdminAmount, isCoupon, couponCode } = req.body;

        // Calculate the total number of people
        const totalPeople = Array.isArray(noOfPeoples) ? noOfPeoples.reduce((sum, num) => sum + num, 0) : 0;

        // Fetch wallet within transaction
        const wallet = await Wallet.findOne({ userId }).session(session);
        if (!wallet) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: "Wallet not found for the user" });
        }

        if (wallet.balance < totalAmount) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: "Insufficient wallet balance for the booking" });
        }

        if (isCoupon && couponCode) {
            const coupon = await Coupon.findOne({ code: couponCode }).session(session);

            if (!coupon) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({ error: "Invalid coupon code." });
            }

            if (coupon.eventId !== eventId) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({ error: "Coupon is not valid for this event." });
            }

            if (coupon.status !== 'Active' || coupon.noOfUses <= 0) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({ error: "Coupon is either inactive or has reached its usage limit." });
            }

            if (new Date() > new Date(coupon.expirationDate)) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({ error: "Coupon has expired." });
            }

            coupon.noOfUses -= 1;
            await coupon.save({ session });
        }


        // Atomically update event capacity and total amount
        const updatedEvent = await Event.findOneAndUpdate(
            { _id: eventId, eventCapacity: { $gte: totalPeople } },
            { $inc: { eventCapacity: -totalPeople, totalAmount: totalAmount, holdAmount: totalAmount } },
            { new: true, session }
        );

        if (!updatedEvent) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: "Not enough capacity for this booking." });
        }

        const bookingData = req.body;
        const newBooking = new Booking({ ...bookingData, totalAmount: withAdminAmount, withoutAdminAmount: totalAmount });
        await newBooking.save({ session });
        
        // Deduct wallet balance and record transaction atomically
        const updatedWallet = await Wallet.findOneAndUpdate(
            { userId, balance: { $gte: withAdminAmount } },
            {
                $inc: { balance: -withAdminAmount },
                $push: { transactions: { amount: withAdminAmount, type: 'Debit', description: `Booking payment for event: ${updatedEvent.eventTitle}` } }
            },
            { new: true, session }
        );

        if (!updatedWallet) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: "Insufficient wallet balance for the booking" });
        }

        // Credit 2.5% fee to Admin Wallet
        const adminFee = withAdminAmount - totalAmount;
        const adminWalletId = process.env.ADMIN_WALLET_ID;
        let adminWallet = await Wallet.findById(adminWalletId).session(session);

        if (!adminWallet) {
            await session.abortTransaction();
            return res.status(404).json({ error: 'Admin wallet not found' });
        }


        adminWallet.balance += adminFee;
        adminWallet.transactions.push({
            amount: adminFee,
            type: 'Credit',
            description: `Commission (Platform Fees) from booking transaction ID: ${newBooking.transactionId}`
        });

        await adminWallet.save({ session });

        // Commit transaction
        await session.commitTransaction();
        session.endSession();

        // Fetch user email (outside transaction)
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Send booking confirmation email
        await sendBookingConfirmationEmail(user.emailID, newBooking, updatedEvent);

        // Send notification (wrap in try-catch to avoid breaking the main flow)
        try {
            await notificationController.sendNotification(
                "bookings",
                "Booking Confirmed",
                `Your booking for "${updatedEvent.eventTitle}" has been confirmed.`,
                userId
            );
        } catch (err) {
            console.error("Failed to create notification:", err);
        }

        const rewardResult = await generateRewardIfEligible(userId);

        if (rewardResult.success) {
            try {
                await notificationController.sendNotification(
                    "reward",
                    "Reward Earned",
                    `You've earned a reward for your booking. Check your rewards section for details!`,
                    userId
                );
            } catch (err) {
                console.error("Failed to create notification:", err);
            }
        }

        res.status(201).json({
            message: 'Booking successful',
            booking: newBooking,
            reward: rewardResult.success ? rewardResult.reward : rewardResult.message
        });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();

        if (error.name === 'ValidationError') {
            return res.status(400).json({
                message: "Validation error occurred",
                errors: Object.values(error.errors).map(err => err.message),
            });
        }

        res.status(500).json({ message: "Internal server error: " + error.message });
    }
}



async function sendBookingConfirmationEmail(userEmail, booking, event) {
    try {
        

        const eventDate = new Date(booking.eventDate).toDateString();
        const ticketTypes = ["Standard Pass", "Premium Pass", "Kid Pass"];
        let ticketDetails = [];

        booking.noOfPeoples.forEach((count, index) => {
            if (count > 0) {
                ticketDetails.push(`<li><strong>${ticketTypes[index]}:</strong> ${count}</li>`);
            }
        });


        const transporter = nodemailer.createTransport({
                    service: 'smtp.gmail.com',
                    auth: {
                        user: process.env.EMAIL,
                        pass: process.env.EMAIL_PASSWORD
                    }
                });
                const response = await axios.post(
                'https://mailserver.mallsone.com/api/v1/messages/send',
                {
                    to: userEmail,
                    subject: `Booking Confirmed: ${booking.eventTitle}`,
                    html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border-radius: 8px; background-color: #f9f9f9; border: 1px solid #ddd;">
                    
                    <!-- Header Section -->
                    <div style="text-align: center; background-color: #030711; padding: 15px; border-radius: 8px 8px 0 0;">
                        <img src="https://i.imgur.com/sx36L2V.png" alt="EventHorizon Logo" style="max-width: 80px;">
                        <h2 style="color: #ffffff; margin: 10px 0;">Booking Confirmation</h2>
                    </div>
        
                    <!-- Booking Summary -->
                    <div style="background-color: #ffffff; padding: 20px; border-radius: 0 0 8px 8px;">
                        <p style="font-size: 16px;">Dear <strong>${booking.customer_name}</strong>,</p>
                        <p>We are pleased to confirm your booking for:</p>
                        
                        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin-top: 10px; text-align: center;">
                            <!-- Event Image -->
                            <img src="${event.imageUrl}" alt="${booking.eventTitle}" style="max-width: 120px; border-radius: 5px; margin-bottom: 10px;"> 
                            
                            <h3 style="color: #333;">${booking.eventTitle}</h3>
                            <p><strong>${eventDate}</strong></p>
                        </div>
        
                        <h3 style="color: #0078ff; margin-top: 20px;">Booking Details</h3>
                        <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                            <tr>
                                <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Transaction ID:</strong></td>
                                <td style="padding: 8px; border-bottom: 1px solid #ddd;">${booking.transactionId}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Tickets:</strong></td>
                                <td style="padding: 8px; border-bottom: 1px solid #ddd;">
                                    ${ticketDetails.length ? ticketDetails.join("") : "No tickets booked"}
                                </td>
                            </tr>
                        </table>
        
                        <p style="text-align: center; color: gray; font-size: 12px; margin-top: 20px;">
                            Thank you for booking with us!<br>Best Regards, <br>EventHorizon Team
                        </p>
                    </div>
        
                    <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
        
                    <!-- Footer -->
                    <p style="color:gray; font-size:12px; text-align: center;">This is an autogenerated message. Please do not reply to this email.</p>
                </div>
            `
                },
                {
                    headers: {
                    Authorization: `Bearer ${process.env.PROMAILER_KEY}`,
                    'Content-Type': 'application/json',
                    },
                }
                );

        // const mailOptions = {
        //     from: process.env.EMAIL,
        //     to: userEmail,
        //     subject: `Booking Confirmed: ${booking.eventTitle}`,
        //     html: `
        //         <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border-radius: 8px; background-color: #f9f9f9; border: 1px solid #ddd;">
                    
        //             <!-- Header Section -->
        //             <div style="text-align: center; background-color: #030711; padding: 15px; border-radius: 8px 8px 0 0;">
        //                 <img src="https://i.imgur.com/sx36L2V.png" alt="EventHorizon Logo" style="max-width: 80px;">
        //                 <h2 style="color: #ffffff; margin: 10px 0;">Booking Confirmation</h2>
        //             </div>
        
        //             <!-- Booking Summary -->
        //             <div style="background-color: #ffffff; padding: 20px; border-radius: 0 0 8px 8px;">
        //                 <p style="font-size: 16px;">Dear <strong>${booking.customer_name}</strong>,</p>
        //                 <p>We are pleased to confirm your booking for:</p>
                        
        //                 <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin-top: 10px; text-align: center;">
        //                     <!-- Event Image -->
        //                     <img src="${event.imageUrl}" alt="${booking.eventTitle}" style="max-width: 120px; border-radius: 5px; margin-bottom: 10px;"> 
                            
        //                     <h3 style="color: #333;">${booking.eventTitle}</h3>
        //                     <p><strong>${eventDate}</strong></p>
        //                 </div>
        
        //                 <h3 style="color: #0078ff; margin-top: 20px;">Booking Details</h3>
        //                 <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
        //                     <tr>
        //                         <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Transaction ID:</strong></td>
        //                         <td style="padding: 8px; border-bottom: 1px solid #ddd;">${booking.transactionId}</td>
        //                     </tr>
        //                     <tr>
        //                         <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Tickets:</strong></td>
        //                         <td style="padding: 8px; border-bottom: 1px solid #ddd;">
        //                             ${ticketDetails.length ? ticketDetails.join("") : "No tickets booked"}
        //                         </td>
        //                     </tr>
        //                 </table>
        
        //                 <p style="text-align: center; color: gray; font-size: 12px; margin-top: 20px;">
        //                     Thank you for booking with us!<br>Best Regards, <br>EventHorizon Team
        //                 </p>
        //             </div>
        
        //             <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
        
        //             <!-- Footer -->
        //             <p style="color:gray; font-size:12px; text-align: center;">This is an autogenerated message. Please do not reply to this email.</p>
        //         </div>
        //     `
        // };

        // await transporter.sendMail(mailOptions);

    } catch (error) {
        console.error("Failed to send booking confirmation email:", error);
    }
}



async function updateBooking(req, res) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const bookingId = req.params.bookingId;
        const updatedStatus = req.body.book_status;

        // Find the booking and lock it for update
        const booking = await Booking.findById(bookingId).session(session);
        if (!booking) {
            await session.abortTransaction();
            return res.status(404).json({ error: 'Booking not found' });
        }

        // Calculate total number of people
        const totalPeople = Array.isArray(booking.noOfPeoples)
            ? booking.noOfPeoples.reduce((sum, num) => sum + num, 0)
            : 0;

        // Prevent invalid status changes
        if ((booking.book_status === 'Cancelled' || booking.book_status === 'Completed') && updatedStatus === 'Booked') {
            await session.abortTransaction();
            return res.status(400).json({ error: 'Cancelled or completed bookings cannot be rebooked' });
        }

        if (booking.book_status === 'Cancelled' && updatedStatus === 'Completed') {
            await session.abortTransaction();
            return res.status(400).json({ error: 'Cancelled bookings cannot be marked as completed' });
        }

        if (updatedStatus === 'Cancelled' && booking.book_status !== 'Booked') {
            await session.abortTransaction();
            return res.status(400).json({ error: 'Only "Booked" bookings can be cancelled' });
        }

        if (updatedStatus === 'Completed') {
            try {
                const token = req.cookies.jwt;
                if (!token) {
                    await session.abortTransaction();
                    return res.status(401).json({ error: 'No token provided.' });
                }

                const decoded = jwt.verify(token, process.env.JWTSecret);
                const userTokenId = decoded.key;

                // Fetch the booking and lock it in the session
                const booking = await Booking.findById(bookingId).session(session);
                if (!booking) {
                    await session.abortTransaction();
                    return res.status(404).json({ error: 'Booking not found' });
                }

                // Fetch event and lock it in session
                const event = await Event.findById(booking.eventId).session(session);
                if (!event) {
                    await session.abortTransaction();
                    return res.status(404).json({ error: 'Event not found' });
                }

                if (event.isTemp) {
                    await session.abortTransaction();
                    return res.status(403).json({ error: 'Event is pending and not live for users.' });
                }

                // Ensure the eventId in booking matches the event's _id
                if (booking.eventId !== event._id.toString()) {
                    await session.abortTransaction();
                    return res.status(400).json({ error: 'Booking does not belong to this event.' });
                }

                // Check if the update date matches eventDate
                const indiaDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });// Get current date in YYYY-MM-DD format
                const eventDate = event.eventDate.toISOString().split('T')[0];

                if (indiaDate !== eventDate) {
                    await session.abortTransaction();
                    return res.status(400).json({ error: 'Booking status can only be updated on the event date.' });
                }

                if (event.userId.toString() !== userTokenId) {
                    await session.abortTransaction();
                    return res.status(403).json({ error: 'You are not authorized to update the booking status.' });
                }
            } catch (err) {
                console.error("JWT Verification Error:", err.message);
                await session.abortTransaction();
                return res.status(401).json({ error: 'Invalid token.' });

            }
        }

        if (updatedStatus && updatedStatus !== booking.book_status) {
            if (updatedStatus === 'Cancelled') {
                // Find the event and lock it for update
                const event = await Event.findById(booking.eventId).session(session);
                if (!event) {
                    await session.abortTransaction();
                    return res.status(404).json({ error: 'Event not found' });
                }

                if (event.isTemp) {
                    await session.abortTransaction();
                    return res.status(403).json({ error: 'Event is pending and not live for users.' });
                }

                // Increment event capacity
                event.eventCapacity += totalPeople;

                // Fetch user's wallet and lock it for update
                let wallet = await Wallet.findOne({ userId: booking.userId }).session(session);
                if (!wallet) {
                    await session.abortTransaction();
                    return res.status(404).json({ error: 'Wallet not found for the user' });
                }

                // Process the refund
                const refundAmount = (booking.withoutAdminAmount * 2) - booking.totalAmount;
                const deductAmount = (booking.withoutAdminAmount * 2) - booking.totalAmount;
                wallet.balance += refundAmount;
                event.holdAmount -= deductAmount;
                event.totalAmount -= deductAmount;

                // Record transaction in wallet
                wallet.transactions.push({
                    amount: refundAmount,
                    type: 'Credit',
                    description: `Refund for cancelled transaction ID: ${booking.transactionId}`
                });


                await wallet.save({ session });
                await event.save({ session });

                // Update payment status
                booking.pay_status = 'Amount Refunded to Wallet';
            }

            // Update the booking status
            booking.book_status = updatedStatus;
        }

        await booking.save({ session });

        // Commit transaction
        await session.commitTransaction();
        res.status(200).json(booking);
    } catch (err) {
        // Rollback transaction on failure
        await session.abortTransaction();
        res.status(500).json({ error: 'Internal server error: ' + err.message });
    } finally {
        session.endSession();
    }
}



async function deleteBooking(req, res) {
    const bookingId = req.params.bookingId;

    try {
        const booking = await Booking.findByIdAndDelete(bookingId);

        if (!booking) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        return res.status(204).end();
    } catch (err) {
        return res.status(500).json({ error: 'Internal server error ' + err });
    }
}

async function getUserBookings(req, res) {
    const userId = req.params.userId;

    try {
        const bookings = await Booking.find({ userId: userId });

        if (bookings.length === 0) {
            return res.status(404).json({ message: "No bookings found for this user." });
        }

        res.status(200).json(bookings);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch user bookings' });
    }
}



async function getEventBookings(req, res) {
    const { eventId } = req.params; // Get eventId from request parameters

    try {
        // Fetch bookings for the given eventId
        const bookings = await Booking.find({ eventId: eventId });

        // Check if any bookings were found
        if (bookings.length === 0) {
            return res.status(404).json({ message: 'No bookings found for this event.' });
        }

        // Return the list of bookings
        res.status(200).json(bookings);
    } catch (error) {
        // Handle any errors that occur during the query
        res.status(500).json({ error: 'Error retrieving bookings: ' + error.message });
    }
}

