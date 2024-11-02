const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const Booking = require('../modules/bookingdetails.module');
const User = require('../modules/user.module'); 

const app = express();
app.use(bodyParser.json());

module.exports = {
    validateBookingId,
    validateUserId,
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
    const { userId, eventId, eventTitle, bookingDate, eventDate, noOfPeople, totalAmount, status, nameOfPeople } = req.body;

    if (!userId || !eventId || !noOfPeople || !totalAmount || !nameOfPeople) {
        return res.status(400).json({ error: 'User ID, Event ID, Number of people, Total amount, and Names of people are required fields.' });
    }
    
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

    if (!Number.isInteger(noOfPeople) || noOfPeople < 1) {
        return res.status(400).json({ error: 'Number of people must be a positive integer.' });
    }

    if (typeof totalAmount !== 'number' || totalAmount < 0) {
        return res.status(400).json({ error: 'Total amount must be a non-negative number.' });
    }

    // Validate nameOfPeople array length
    if (!Array.isArray(nameOfPeople) || nameOfPeople.length !== noOfPeople) {
        return res.status(400).json({ error: `The number of names provided (${nameOfPeople.length}) does not match the number of people (${noOfPeople}).` });
    }

    next();
}

async function validateUpdateBooking(req, res, next) {
    const { bookingId } = req.params;
    const { status } = req.body;

    if (!isUuidValid(bookingId)) {
        return res.status(400).json({ error: 'Invalid booking ID. Please provide a valid UUID.' });
    }

    if (!status || !['Booked', 'Cancelled', 'Completed'].includes(status)) {
        return res.status(400).json({ error: 'Status is required and must be either Booked, Cancelled, or Completed.' });
    }

    try {
        const existingBooking = await Booking.findById(bookingId);
        if (!existingBooking) {
            return res.status(404).json({ error: 'Booking not found.' });
        }

        if (status === existingBooking.status) {
            return res.status(400).json({ error: 'New status must be different from the current status.' });
        }

        next();
    } catch (error) {
        res.status(500).json({ error: 'An error occurred while validating the booking. ' + error });
    }
}
