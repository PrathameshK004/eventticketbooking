const express = require('express');
const router = express.Router();
const Event = require('../modules/event.module.js');
const ObjectId = require('mongoose').Types.ObjectId;
const { GridFSBucket } = require('mongodb');
const mongoose = require('mongoose');
const path = require('path');
const { MongoClient } = require('mongodb');
const client = new MongoClient(process.env.CONNECTIONSTRING);

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
    deleteEvent
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

async function createEvent(req, res) {
    try {
        let fileId = null;
        let imageUrl = null;

        let eventFeatures = req.body.eventFeatures || [];
        let eventTags = req.body.eventTags || [];

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

        const newEvent = await Event.create(eventDetails);
        if (!newEvent || !newEvent._id) {
            return res.status(500).json({ error: 'Failed to create event' });
        }

        // Handle file upload if a file is present
        if (req.file) {
            const fileExtension = path.extname(req.file.originalname);
            const newFileName = `${newEvent._id}${fileExtension}`;

            // Upload file to GridFS and get the fileId
            try {
                const fileUploadResult = await new Promise((resolve, reject) => {
                    const uploadStream = bucket.openUploadStream(newFileName, {
                        contentType: req.file.mimetype,
                    });
                    uploadStream.end(req.file.buffer);

                    uploadStream.on('finish', async (file) => {
                        console.log('File uploaded successfully:', file);
                        resolve(file._id);
                    });

                    uploadStream.on('error', (err) => {
                        console.error('Upload failed:', err);
                        reject(err);
                    });
                });

                fileId = fileUploadResult;
                imageUrl = `https://eventticketbooking-cy6o.onrender.com/file/retrieve/${newFileName}`;

                // Update event with fileId and imageUrl
                newEvent.fileId = fileId;
                newEvent.imageUrl = imageUrl;
                await newEvent.save();
            } catch (uploadError) {
                console.error('Error uploading file:', uploadError);
                return res.status(500).json({ error: 'File upload failed.' });
            }
        }

        // Respond with the created event details
        res.status(201).json(newEvent);
    } catch (error) {
        console.error('Error creating event:', error);
        res.status(500).json({ error: 'Failed to create event', details: error.message });
    }
}



async function connectDB() {
    if (!client.topology || !client.topology.isConnected()) {
        await client.connect();
        console.log("MongoDB connected successfully.");
    }
}


// Update event
async function updateEvent(req, res) {
    const eventId = req.params.eventId;
    const updatedEventData = req.body;

    try {
        // First, update event data in the database
        const event = await Event.findByIdAndUpdate(
            eventId,
            { $set: updatedEventData }, // Apply the updates
            { new: true, runValidators: true } // Get the updated document
        );


        const eventForId = await Event.findById(eventId);

        if (!event || !eventForId) {
            return res.status(404).json({ error: 'Event not found' });
        }

        // If a new file is uploaded, handle the file update
        if (req.file) {
            // Delete the old file from GridFS, if one exists
            if (event.fileId) {
                await bucket.delete(new ObjectId(event.fileId));
            }

            const fileExtension = path.extname(req.file.originalname);
            const newFileName = `${eventId}${fileExtension}`;

            const uploadStream = bucket.openUploadStream(newFileName, {
                contentType: req.file.mimetype,
            });

            uploadStream.end(req.file.buffer);

            // On file upload success, retrieve file metadata
            try {
                // Connect to MongoDB and retrieve the file metadata
                const db = client.db('eventticketbooking');
                const filesCollection = db.collection('uploads.files'); // GridFS metadata collection

                // Query to find the file by its filename
                const uploadedFile = await filesCollection.findOne({ filename: newFileName });

                if (!uploadedFile) {
                    return res.status(404).json({ error: 'File not found.' });
                }

                // Extract file metadata
                const fileMetadata = {
                    _id: uploadedFile._id,
                    chunkSize: uploadedFile.chunkSize,
                    contentType: uploadedFile.contentType,
                    filename: uploadedFile.filename,
                    length: uploadedFile.length,
                    uploadDate: uploadedFile.uploadDate,
                };

                // Update event with the new file metadata
                eventForId.fileId = fileMetadata._id;
                const imageUrl = `https://eventticketbooking-cy6o.onrender.com/file/retrieve/${newFileName}`;
                event.imageUrl = imageUrl;

                await event.save(); // Save the updated event with the new file data

                // Send response after event and file update are completed
                return res.status(201).json({ event, fileMetadata });

            } catch (err) {
                console.error('Error retrieving file info:', err);
                return res.status(500).json({ error: 'Error retrieving file info from the database.' });
            } finally {
                await client.close(); // Close MongoDB connection
            }
        }

        // Handle optional updates for eventFeatures and eventTags
        if (updatedEventData.eventFeatures !== undefined) {
            if (typeof updatedEventData.eventFeatures === 'string') {
                event.eventFeatures = updatedEventData.eventFeatures
                    .split(',')
                    .map((feature) => feature.trim());
            } else {
                event.eventFeatures = updatedEventData.eventFeatures;
            }
        }

        if (updatedEventData.eventTags !== undefined) {
            if (typeof updatedEventData.eventTags === 'string') {
                event.eventTags = updatedEventData.eventTags
                    .split(',')
                    .map((tag) => tag.trim());
            } else {
                event.eventTags = updatedEventData.eventTags;
            }
        }

        // Update other fields dynamically
        for (const key of Object.keys(updatedEventData)) {
            if (!['eventFeatures', 'eventTags'].includes(key)) {
                event[key] = updatedEventData[key];
            }
        }

        await event.save(); // Save the final updated event data

        // Respond with the updated event data
        return res.status(200).json({
            event,
            message: req.file ? 'Event updated with new image successfully!' : 'Event updated successfully!',
        });

    } catch (err) {
        console.error('Error updating event:', err);
        return res.status(500).json({ error: 'Internal server error' });
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
            await bucket.delete(new ObjectId(event.fileId));
        }

        return res.status(204).end();
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

