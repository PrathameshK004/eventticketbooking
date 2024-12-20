const express = require('express');
const router = express.Router();
const Booking = require('../modules/bookingdetails.module.js');
const Event = require('../modules/event.module.js');
const mongoose = require('mongoose');

module.exports = {
    getAllBookings: getAllBookings,
    getBookingById: getBookingById,
    createBooking: createBooking,
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
    try {
        // Create the booking
        const newBooking = await Booking.create(req.body);

        // Find the event by eventId and update its capacity
        const event = await Event.findById(req.body.eventId);
        if (event) {
            // Decrement the event capacity by the number of people in the booking
            event.eventCapacity -= req.body.noOfPeople;

            // Ensure event capacity doesn't go below zero
            if (event.eventCapacity < 0) {
                return res.status(400).json({ message: "Not enough capacity for this booking." });
            }

            // Save the updated event
            await event.save();
        } else {
            // Rollback booking if event is not found
            await Booking.findByIdAndDelete(newBooking._id);
            return res.status(404).json({ message: "Event not found" });
        }

        // Respond with the created booking
        res.status(201).json(newBooking);
    } catch (error) {
        if (error.name === 'ValidationError') {
            const errorMessages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                message: "Validation error occurred",
                errors: errorMessages 
            });
        }
        
        res.status(500).json({ message: "Internal server error " +error.message});
    }
}

async function updateBooking(req, res) {
    const bookingId = req.params.bookingId;
    const updatedStatus = req.body.status; // Only update status

    try {
        const booking = await Booking.findById(bookingId);

        if (!booking) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        // Prevent changing from "Cancelled" or "Completed" back to "Booked"
        if ((booking.status === 'Cancelled' || booking.status === 'Completed') && updatedStatus === 'Booked') {
            return res.status(400).json({ error: 'Cancelled or completed bookings cannot be rebooked' });
        }

        // Allow cancellation only if the current status is "Booked"
        if (updatedStatus === 'Cancelled' && booking.status !== 'Booked') {
            return res.status(400).json({ error: 'Only "Booked" bookings can be cancelled' });
        }

        // Update only if status is being changed
        if (updatedStatus && updatedStatus !== booking.status) {
            if (updatedStatus === 'Cancelled') {
                const event = await Event.findById(booking.eventId);
                if (event) {
                    event.eventCapacity += booking.noOfPeople;
                    await event.save();
                } else {
                    return res.status(404).json({ error: 'Event not found' });
                }
            }

            // Update the booking status
            booking.status = updatedStatus;
        }

        await booking.save(); // Save the booking with the updated status
        res.status(200).json(booking);
    } catch (err) {
        res.status(500).json({ error: 'Internal server error ' + err });
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

