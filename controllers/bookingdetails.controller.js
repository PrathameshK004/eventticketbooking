const express = require('express');
const router = express.Router();
const Booking = require('../modules/bookingdetails.module.js');
const Event = require('../modules/event.module.js');
const User = require('../modules/user.module.js');
const mongoose = require('mongoose');
const Wallet = require('../modules/wallet.module.js');
const nodemailer = require('nodemailer');

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
        res.status(500).json({ message: "Internal Server Error "+ err.message });
    }
}


async function createBooking(req, res) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { userId, eventId, noOfPeoples, totalAmount } = req.body;

        // Calculate the sum of the array of `noOfPeoples`
        const totalPeople = Array.isArray(noOfPeoples) ? noOfPeoples.reduce((sum, num) => sum + num, 0) : 0;

        // Find the event and lock it for update
        const event = await Event.findById(eventId).session(session);
        if (!event) {
            return res.status(404).json({ message: "Event not found" });
        }

        // Ensure event has enough capacity
        if (event.eventCapacity < totalPeople) {
            return res.status(400).json({ message: "Not enough capacity for this booking." });
        }

        // Create the booking within the transaction
        const newBooking = await Booking.create([{ ...req.body }], { session });

        // Update event capacity and total amount
        event.eventCapacity -= totalPeople;
        event.totalAmount = (event.totalAmount || 0) + totalAmount;
        await event.save({ session });

        // Commit transaction
        await session.commitTransaction();
        session.endSession();

        // Fetch user email (outside transaction)
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Send confirmation email asynchronously
        await sendBookingConfirmationEmail(user.emailID, newBooking[0], event);

        res.status(201).json(newBooking[0]);
    } catch (error) {
        // Rollback transaction on failure
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
        const { userId, eventId, noOfPeoples, totalAmount } = req.body;

        // Calculate the sum of the array of `noOfPeoples`
        const totalPeople = Array.isArray(noOfPeoples) ? noOfPeoples.reduce((sum, num) => sum + num, 0) : 0;

        // Fetch wallet within transaction
        const wallet = await Wallet.findOne({ userId }).session(session);
        if (!wallet) {
            return res.status(404).json({ message: "Wallet not found for the user" });
        }

        // Check if the wallet has enough balance
        if (wallet.balance < totalAmount) {
            return res.status(400).json({ message: "Insufficient wallet balance for the booking" });
        }

        // Find the event and lock it for update
        const event = await Event.findById(eventId).session(session);
        if (!event) {
            return res.status(404).json({ message: "Event not found" });
        }

        // Ensure event has enough capacity
        if (event.eventCapacity < totalPeople) {
            return res.status(400).json({ message: "Not enough capacity for this booking." });
        }

        // Create the booking within the transaction
        const newBooking = await Booking.create([{ ...req.body }], { session });

        // Update event capacity and total amount
        event.eventCapacity -= totalPeople;
        event.totalAmount = (event.totalAmount || 0) + totalAmount;
        await event.save({ session });

        // Deduct wallet balance and record transaction
        wallet.balance -= totalAmount;
        wallet.transactions.push({
            amount: totalAmount,
            type: 'Debit',
            description: `Booking payment for event: ${event.eventTitle}`,
        });
        await wallet.save({ session });

        // Commit transaction
        await session.commitTransaction();
        session.endSession();

        // Fetch user email (outside transaction)
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Send confirmation email asynchronously
        await sendBookingConfirmationEmail(user.emailID, newBooking[0], event);

        res.status(201).json(newBooking[0]);
    } catch (error) {
        // Rollback transaction on failure
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
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL,
                pass: process.env.EMAIL_PASSWORD,
            },
        });

        const eventDate = new Date(booking.eventDate).toDateString(); 
        const ticketTypes = ["Standard Pass", "Premium Pass", "Kid Pass"];
        let ticketDetails = [];

        booking.noOfPeoples.forEach((count, index) => {
            if (count > 0) {
                ticketDetails.push(`<li><strong>${ticketTypes[index]}:</strong> ${count}</li>`);
            }
        });

        const mailOptions = {
            from: process.env.EMAIL,
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
        };
        
        await transporter.sendMail(mailOptions);
        
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
            return res.status(404).json({ error: 'Booking not found' });
        }

        // Calculate the sum of the array of `noOfPeoples`
        const totalPeople = Array.isArray(booking.noOfPeoples)
            ? booking.noOfPeoples.reduce((sum, num) => sum + num, 0)
            : 0;

        // Prevent changing from "Cancelled" or "Completed" back to "Booked"
        if ((booking.book_status === 'Cancelled' || booking.book_status === 'Completed') && updatedStatus === 'Booked') {
            return res.status(400).json({ error: 'Cancelled or completed bookings cannot be rebooked' });
        }

        // Prevent changing from "Cancelled" to "Completed"
        if (booking.book_status === 'Cancelled' && updatedStatus === 'Completed') {
            return res.status(400).json({ error: 'Cancelled bookings cannot be marked as completed' });
        }

        // Allow cancellation only if the current status is "Booked"
        if (updatedStatus === 'Cancelled' && booking.book_status !== 'Booked') {
            return res.status(400).json({ error: 'Only "Booked" bookings can be cancelled' });
        }

        if (updatedStatus && updatedStatus !== booking.book_status) {
            if (updatedStatus === 'Cancelled') {
                // Find the event and lock it for update
                const event = await Event.findById(booking.eventId).session(session);
                if (!event) {
                    return res.status(404).json({ error: 'Event not found' });
                }

                // Increment event capacity
                event.eventCapacity += totalPeople;

                // Fetch user's wallet and lock it for update
                let wallet = await Wallet.findOne({ userId: booking.userId }).session(session);
                if (!wallet) {
                    return res.status(404).json({ error: 'Wallet not found for the user' });
                }

                // Process the refund
                const refundAmount = booking.totalAmount; // Assuming totalAmount is stored in booking
                wallet.balance += refundAmount;
                event.totalAmount -= refundAmount;

                // Record transaction in wallet
                wallet.transactions.push({
                    amount: refundAmount,
                    type: 'Credit',
                    description: `Refund for cancelled transaction ID: ${booking.transactionId}`
                });

                await event.save({ session });
                await wallet.save({ session });

                // Update payment status
                booking.pay_status = 'Amount Refunded to Wallet';
            }

            // Update the booking status
            booking.book_status = updatedStatus;
        }

        await booking.save({ session });

        // Commit transaction
        await session.commitTransaction();
        session.endSession();

        res.status(200).json(booking);
    } catch (err) {
        // Rollback transaction on failure
        await session.abortTransaction();
        session.endSession();

        res.status(500).json({ error: 'Internal server error: ' + err.message });
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
        return res.status(500).json({ error: 'Internal server error ' +err});
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
        const bookings = await Booking.find({ eventId: eventId  });

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

