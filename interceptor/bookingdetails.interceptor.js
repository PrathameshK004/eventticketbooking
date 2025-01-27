const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const Booking = require('../modules/bookingdetails.module');
const User = require('../modules/user.module'); 
const Event = require('../modules/event.module'); 
const jwt = require('jsonwebtoken');

const app = express();
app.use(bodyParser.json());

module.exports = {
    validateBookingId,
    validateUserId,
    validateEventId,
    validateNewBooking,
    validateUpdateBooking
};

function isUuidValid(id) {
    return mongoose.Types.ObjectId.isValid(id);
}

function validateBookingId(req, res, next) {
    const { bookingId } = req.params;
    if (!bookingId) {
        return res.status(400).json({ error: 'Booking ID is required.' });
    }
    if (!isUuidValid(bookingId)) {
        return res.status(400).json({ error: 'Invalid booking ID. Please provide a valid UUID.' });
    }
    next();
}

async function validateUserId(req, res, next) {
    const { userId } = req.params;
    if (!userId || !isUuidValid(userId)) {
        return res.status(400).json({ error: 'User ID is required and must be a valid UUID.' });
    }
    try {
        const userExists = await User.findById(userId);
        if (!userExists) {
            return res.status(404).json({ error: 'User ID not found in the database.' });
        }
        next();
    } catch (error) {
        res.status(500).json({ error: 'An error occurred while validating the user ID. ' + error });
    }
}

async function validateNewBooking(req, res, next) {
    const { 
        userId, 
        eventId, 
        customer_name, 
        eventTitle, 
        bookingDate, 
        eventDate, 
        totalAmount, 
        pay_status, 
        book_status 
    } = req.body;

    // Check for required fields
    if (!userId || !eventId || !totalAmount || !pay_status) {
        return res.status(400).json({ error: 'User ID, Event ID, Total amount, Payment status, and Booking status are required fields.' });
    }
    
    // Validate UUID for userId
    if (typeof userId !== 'string' || !isUuidValid(userId)) {
        return res.status(400).json({ error: 'User ID must be a valid UUID string.' });
    }

    try {
        const userExists = await User.findById(userId);
        if (!userExists) {
            return res.status(404).json({ error: 'User ID not found in the database.' });
        }
    } catch (error) {
        return res.status(500).json({ error: 'An error occurred while validating the user ID. ' + error });
    }

    // Validate totalAmount
    if (typeof totalAmount !== 'number' || totalAmount < 0) {
        return res.status(400).json({ error: 'Total amount must be a non-negative number.' });
    }

    // Validate pay_status
    if (!['Successful'].includes(pay_status)) {
        return res.status(400).json({ error: `Payment is not Successful.` });
    }

    // Validate bookingDate and eventDate
    if (new Date(bookingDate) > new Date(eventDate)) {
        return res.status(400).json({ error: 'Booking date must be earlier than the event date.' });
    }

    next();
}


async function validateUpdateBooking(req, res, next) {
    const { bookingId } = req.params;
    const { book_status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
        return res.status(400).json({ error: 'Invalid booking ID. Please provide a valid ObjectId.' });
    }

    if (!book_status || !['Booked', 'Cancelled', 'Completed'].includes(book_status)) {
        return res.status(400).json({ error: 'Booking status is required and must be either Booked, Cancelled, or Completed.' });
    }

    try {
        const existingBooking = await Booking.findById(bookingId);
        if (!existingBooking) {
            return res.status(404).json({ error: 'Booking not found.' });
        }

        if (book_status === existingBooking.book_status) {
            return res.status(400).json({ error: 'New booking status must be different from the current status.' });
        }

        const eventDetails = await Event.findById(existingBooking.eventId);
        if (!eventDetails) {
            return res.status(404).json({ error: 'Event not found.' });
        }

        const userId = eventDetails.userId; 

        const token = req.cookies.jwt;
        if (!token) {
            return res.status(401).json({ error: 'No token provided.' });
        }

        const decoded = jwt.verify(token, process.env.JWTSecret);
        const userTokenId = decoded.key;

        if (userId.toString() !== userTokenId) {
            return res.status(403).json({ error: 'You are not organizer to update the booking status.' });
        }

        next();
    } catch (error) {
        console.error(error); 
        res.status(500).json({ error: 'An error occurred while validating the booking.', details: error.message });
    }
}

async function validateEventId(req, res, next) {
    const { eventId } = req.params;
    if (!eventId || !isUuidValid(eventId)) {
        return res.status(400).json({ error: 'Event ID is required and must be a valid UUID.' });
    }
    try {
        const eventExists = await Event.findById(eventId);
        if (!eventExists) {
            return res.status(404).json({ error: 'Event ID not found in the database.' });
        }
        next();
    } catch (error) {
        res.status(500).json({ error: 'An error occurred while validating the event ID. ' + error });
    }
}