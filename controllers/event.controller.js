const express = require('express');
const router = express.Router();
const Event = require('../modules/event.module.js');
const ObjectId=require('mongoose').Types.ObjectId;
const { GridFSBucket } = require('mongodb');
const mongoose = require('mongoose');

// Initialize GridFSBucket
let bucket;

const conn = mongoose.connection;
conn.once('open', () => {
    bucket = new GridFSBucket(conn.db, { bucketName: 'uploads' });
});

module.exports = {
    getAllEvents: getAllEvents,
    getEventById: getEventById,
    createEvent: createEvent,
    updateEvent: updateEvent,
    deleteEvent: deleteEvent,
    searchEventsByKeyword: searchEventsByKeyword
}


// Get all events
function getAllEvents(req, res) {
    //const page = parseInt(req.query.page) || 1; // Default to page 1 if not provided
    //const limit = parseInt(req.query.limit) || 4; // Default to 4 events per page
    //const skip = (page - 1) * limit; // Calculate how many documents to skip

    Event.find()
        //.skip(skip) // Skip documents according to the page
       // .limit(limit) // Limit the number of documents returned
        .then(events => res.status(200).json(events))
        .catch(err => {
            console.error(err.message);
            res.status(500).json({ error: 'Failed to fetch events' });
        });
}

// Get event by ID
async function getEventById(req, res) {
    const eventId = req.params.eventId;

    try {
        const event = await Event.findById(eventId);

        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        res.status(200).json(event);
    } catch (err) {
        console.error('Internal server error:', err.message);
        res.status(500).json({ message: 'Internal Server Error' });
    }
}

// Create a new event with file upload
async function createEvent(req, res) {
    try {
        let fileId = null;

        // Handle file upload if a file is present
        if (req.file) {
            const uploadResult = await new Promise((resolve, reject) => {
                const uploadStream = bucket.openUploadStream(req.file.originalname, {
                    contentType: req.file.mimetype,
                });
                uploadStream.end(req.file.buffer);

                uploadStream.on('finish', (file) => resolve(file));
                uploadStream.on('error', (err) => reject(err));
            });

            console.log('File uploaded successfully:', uploadResult);
            fileId = uploadResult._id; // Store file ID for event
        }

        // Create a new event object with fileId
        const eventDetails = {
            ...req.body,
            fileId, // Add fileId to event details
        };

        // Save the new event to the database
        const newEvent = await Event.create(eventDetails);

        res.status(201).json(newEvent);
    } catch (error) {
        console.error('Error creating event:', error);
        if (error.name === 'ValidationError') {
            // Handle Mongoose validation errors
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ errors });
        }
        res.status(500).json({ error: 'Failed to create event' });
    }
}

// Update event
async function updateEvent(req, res) {
    const eventId = req.params.eventId;
    const updatedEventData = req.body;

    try {
        const event = await Event.findById(eventId);

        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }

        Object.assign(event, updatedEventData);
        await event.save();

        res.status(200).json(event);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Delete event
async function deleteEvent(req, res) {
    const eventId = req.params.eventId;

    try {
        const event = await Event.findByIdAndDelete(eventId);

        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }

        return res.status(204).end();
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

// Search events by keyword
async function searchEventsByKeyword(req, res) {
    try {
        const keyword = req.query.q;

        if (!keyword) {
            return res.status(400).json({ error: 'Please provide a keyword to search for.' });
        }

        const events = await Event.find({
            $or: [
                { eventTitle: { $regex: keyword, $options: 'i' } },
                { eventAddress: { $regex: keyword, $options: 'i' } },
                { eventOrganizer: { $regex: keyword, $options: 'i' } },
            ],
        });

        if (events.length === 0) {
            return res.status(404).json({ message: 'No events found matching the keyword.' });
        }

        res.status(200).json(events);
    } catch (error) {
        res.status(500).json({ error: 'Error occurred while searching for events.' });
    }
}

