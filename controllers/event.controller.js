const express = require('express');
const router = express.Router();
const Event = require('../modules/event.module.js');
const ObjectId = require('mongoose').Types.ObjectId;
const { GridFSBucket } = require('mongodb');
const mongoose = require('mongoose');
const path = require('path');
const { MongoClient } = require('mongodb');
const jwt = require('jsonwebtoken');
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

        let token = req.query.token;
        if (!token) {
            token = req.cookies.jwt; 
        }

        if (!token) {
            return res.status(401).json({ message: 'No token provided' });
        }

        const decoded = jwt.verify(token, process.env.JWTSecret);
        const userId = decoded.key;

        const userDetail = await User.findById( userId );
        if(!userDetail){
            return res.status(404).json({ message: "User not found" });
        }

        if (!userDetail.roles.includes(1) && !userDetail.roles.includes(2)) {
            return res.status(403).json({ message: 'You are not authorized to add an event. You are not an Admin or Organizer.' });
        }
        

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
            eventOrgFacebook: req.body.eventOrgFacebook,
            userId: userId
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
                        console.log('File uploaded successfully');
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
                const savedEvent = await newEvent.save();

                await User.findByIdAndUpdate(
                    userId,
                    { $push: { eventId: savedEvent._id } }, // Push the eventId into the user's eventId array
                    { new: true } // Return the updated user document
                );

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


async function updateEvent(req, res) {
    const eventId = req.params.eventId;
    const updatedEventData = req.body;

    try {
        // Find the event before updating
        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }

        // Handle optional updates for eventFeatures and eventTags
        if (updatedEventData.eventFeatures !== undefined) {
            event.eventFeatures = Array.isArray(updatedEventData.eventFeatures)
                ? updatedEventData.eventFeatures
                : updatedEventData.eventFeatures.split(',').map((f) => f.trim());
        }

        if (updatedEventData.eventTags !== undefined) {
            event.eventTags = Array.isArray(updatedEventData.eventTags)
                ? updatedEventData.eventTags
                : updatedEventData.eventTags.split(',').map((t) => t.trim());
        }

        // Update other fields dynamically
        Object.keys(updatedEventData).forEach((key) => {
            if (!['eventFeatures', 'eventTags'].includes(key)) {
                event[key] = updatedEventData[key];
            }
        });

        let newFileId = null;
        let newImageUrl = event.imageUrl;

        // If a new file is uploaded, replace the old file
        if (req.file) {
            try {
                const fileExtension = path.extname(req.file.originalname);
                const newFileName = `${eventId}${fileExtension}`;

                // Upload the new file to GridFS
                const fileUploadResult = await new Promise((resolve, reject) => {
                    const uploadStream = bucket.openUploadStream(newFileName, {
                        contentType: req.file.mimetype,
                    });

                    uploadStream.end(req.file.buffer);

                    uploadStream.on('finish', (file) => {
                        console.log('File uploaded successfully');
                        resolve(file._id);
                    });

                    uploadStream.on('error', (err) => {
                        console.error('Upload failed:', err);
                        reject(err);
                    });
                });

                newFileId = fileUploadResult;
                newImageUrl = `https://eventticketbooking-cy6o.onrender.com/file/retrieve/${newFileName}`;

                // Delete the old file **only after** new one is successfully uploaded
                if (event.fileId) {
                    try {
                        await bucket.delete(new ObjectId(event.fileId));
                    } catch (deleteError) {
                        console.error('Error deleting old file:', deleteError);
                    }
                }
            } catch (uploadError) {
                console.error('Error uploading new file:', uploadError);
                return res.status(500).json({ error: 'File upload failed.' });
            }
        }

        // Update the event with new file details (if applicable)
        if (newFileId) {
            event.fileId = newFileId;
            event.imageUrl = newImageUrl;
        }

        await event.save(); // Save the updated event

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

