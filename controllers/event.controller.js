const express = require('express');
const router = express.Router();
const Event = require('../modules/event.module.js');
const ObjectId = require('mongoose').Types.ObjectId;
const { GridFSBucket } = require('mongodb');
const mongoose = require('mongoose');
const path = require('path');

// Initialize GridFSBucket
let bucket;

const conn = mongoose.connection;
conn.once('open', () => {
    bucket = new GridFSBucket(conn.db, { bucketName: 'uploads' });
});

module.exports = {
    getAllEvents,
    getEventById,
    createEvent,
    updateEvent,
    deleteEvent,
    searchEventsByKeyword
};

// Get all events
function getAllEvents(req, res) {
    Event.find()
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
    console.log('Received request body:', req.body);
    console.log('Received file:', req.file);

    try {
        let fileId = null;
        let imageUrl = null;

        // Directly use eventFeatures and eventTags as arrays from the request body
        let eventFeatures = req.body.eventFeatures || [];
        let eventTags = req.body.eventTags || [];

        // Ensure that eventFeatures and eventTags are arrays
        if (!Array.isArray(eventFeatures) || !Array.isArray(eventTags)) {
            return res.status(400).json({ error: 'Event features or tags must be valid JSON arrays' });
        }

        // Create a new event object
        const eventDetails = {
            eventTitle: req.body.eventTitle,
            eventDate: new Date(req.body.eventDate),
            eventAddress: req.body.eventAddress,
            eventOrganizer: req.body.eventOrganizer,
            eventPrice: parseFloat(req.body.eventPrice),
            eventDescription: req.body.eventDescription,
            eventLanguage: req.body.eventLanguage,
            eventRating: req.body.eventRating ? parseFloat(req.body.eventRating) : undefined,
            eventCapacity: parseInt(req.body.eventCapacity),
            eventDuration: req.body.eventDuration,
            eventFeatures: eventFeatures,
            eventTags: eventTags,
            eventOrgInsta: req.body.eventOrgInsta,
            eventOrgX: req.body.eventOrgX,
            eventOrgFacebook: req.body.eventOrgFacebook
        };

        // Save the new event to the database
        const newEvent = await Event.create(eventDetails);

        // Check if the event was saved successfully
        if (!newEvent || !newEvent._id) {
            return res.status(500).json({ error: 'Failed to create event, no event created or no _id assigned.' });
        }

        console.log('Event created successfully:', newEvent);

        // Handle file upload if a file is present
        if (req.file) {
            const fileExtension = path.extname(req.file.originalname);
            const newFileName = `${newEvent._id}${fileExtension}`;

            console.log('Uploading file with name:', newFileName);

            try {
                // Upload the file to GridFS
                const uploadStream = bucket.openUploadStream(newFileName, {
                    contentType: req.file.mimetype,
                });

                uploadStream.end(req.file.buffer);

                uploadStream.on('finish', (file) => {
                    console.log('File uploaded successfully:', file);

                    if (file && file._id) {
                        fileId = file._id;
                        imageUrl = `/api/events/image/${fileId}`;

                        // Update the event with file ID and image URL
                        newEvent.fileId = fileId;
                        newEvent.imageUrl = imageUrl;

                        // Save the updated event with file details
                        newEvent.save()
                            .then(() => {
                                console.log('Event updated with file details');
                                res.status(201).json(newEvent);
                            })
                            .catch((err) => {
                                console.error('Error saving event with file:', err);
                                res.status(500).json({ error: 'Error saving event with file' });
                            });
                    } else {
                        console.error('Upload failed: Missing file._id');
                        res.status(500).json({ error: 'File upload failed, _id missing from upload result.' });
                    }
                });

                uploadStream.on('error', (err) => {
                    console.error('File upload failed:', err);  // Log error details
                    res.status(500).json({ error: 'File upload failed', details: err.message });
                });

            } catch (err) {
                console.error('Error during file upload:', err);
                res.status(500).json({ error: 'Error during file upload', details: err.message });
            }
        }
    } catch (error) {
        console.error('Error creating event:', error);
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ errors });
        }
        res.status(500).json({ error: 'Failed to create event', details: error.message });
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

        // If there's an associated file, delete it from GridFS
        if (event.fileId) {
            await bucket.delete(ObjectId(event.fileId));
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
