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

// Create a new event with file upload
async function createEvent(req, res) {
    try {
        let fileId = null;
        let imageUrl = null;

        // Directly use eventFeatures and eventTags as arrays from the request body
        let eventFeatures = req.body.eventFeatures || [];
        let eventTags = req.body.eventTags || [];



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
            eventFeatures: eventFeatures,  // Directly use eventFeatures array
            eventTags: eventTags,  // Directly use eventTags array
            eventOrgInsta: req.body.eventOrgInsta,
            eventOrgX: req.body.eventOrgX,
            eventOrgFacebook: req.body.eventOrgFacebook
        };

        // Save the new event to the database
        const newEvent = await Event.create(eventDetails);

        if (!newEvent || !newEvent._id) {
            return res.status(500).json({ error: 'Failed to create event' });
        }

        // Handle file upload if a file is present
        if (req.file) {
            const fileExtension = path.extname(req.file.originalname);
            const newFileName = `${newEvent._id}${fileExtension}`; // Naming the file with the eventId

            // Upload the file to GridFS
            const uploadStream = bucket.openUploadStream(newFileName, {
                contentType: req.file.mimetype,
            });
            uploadStream.end(req.file.buffer);

            // On file upload success, get the file's _id
            uploadStream.on('finish', async (file) => {
                console.log('File uploaded successfully:', file);

                // Now that we have uploaded the file, retrieve its metadata
                try {
                    // Connect to MongoDB
                    const db = client.db('eventticketbooking'); 
                    const filesCollection = db.collection('uploads.files'); // The collection where GridFS stores file metadata

                    // Query the fs.files collection to find the file by its filename
                    const uploadedFile = await filesCollection.findOne({ filename: newFileName });

                    // If no file found, return a 404 error
                    if (!uploadedFile) {
                        return res.status(404).json({ error: 'File not found.' });
                    }

                    // Send file metadata as a response
                    const fileMetadata = {
                        _id: uploadedFile._id,
                        chunkSize: uploadedFile.chunkSize,
                        contentType: uploadedFile.contentType,
                        filename: uploadedFile.filename,
                        length: uploadedFile.length,
                        uploadDate: uploadedFile.uploadDate,
                    };

                    newEvent.fileId = fileMetadata._id;

                    // Construct image URL based on the file _id
                    imageUrl = `https://eventticketbooking-cy6o.onrender.com/file/retrieve/${newFileName}`;

                    // Update the event document with the fileId and imageUrl
                    newEvent.imageUrl = imageUrl;
                    await newEvent.save();

                    // Respond with the created event and file details
                    res.status(201).json({ event: newEvent, fileMetadata });
                } catch (err) {
                    console.error('Error retrieving file info:', err);
                    res.status(500).json({ error: 'Error retrieving file info from the database.' });
                } finally {
                    await client.close(); // Close MongoDB connection after the operation
                }
            });

            // Handle upload failure
            uploadStream.on('error', (err) => {
                console.error('Upload failed:', err);
                res.status(500).json({ error: 'File upload failed.' });
            });
        } else {
            // If no file is uploaded, return the event without file info
            res.status(201).json(newEvent);
        }
    } catch (error) {
        console.error('Error creating event:', error);
        res.status(500).json({ error: 'Failed to create event', details: error.message });
    }
}



async function updateEvent(req, res) {
    const eventId = req.params.eventId;
    const updatedEventData = req.body;

    let client;

    try {
        // MongoDB client connection
        client = await MongoClient.connect(process.env.CONNECTIONSTRING, { useNewUrlParser: true, useUnifiedTopology: true });
        const db = client.db('eventticketbooking'); 

        // Update event data
        const event = await Event.findByIdAndUpdate(
            eventId,
            { $set: updatedEventData }, // Apply the updates
            { new: true, runValidators: true } // Get the updated document
        );
        
        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }

        // Handle file upload if a new file is provided
        if (req.file) {
            // Delete the old file from GridFS if it exists
            if (event.fileId) {
                try {
                    await bucket.delete(ObjectId(event.fileId));
                } catch (err) {
                    console.error('Error deleting old file:', err);
                }
            }

            // Prepare for file upload
            const fileExtension = path.extname(req.file.originalname);
            const newFileName = `${eventId}${fileExtension}`;
            const uploadStream = bucket.openUploadStream(newFileName, {
                contentType: req.file.mimetype,
            });

            uploadStream.end(req.file.buffer);

            // On successful file upload, retrieve file metadata
            const filesCollection = db.collection('uploads.files');
            const uploadedFile = await filesCollection.findOne({ filename: newFileName });

            if (!uploadedFile) {
                return res.status(404).json({ error: 'File not found.' });
            }

            const fileMetadata = {
                _id: uploadedFile._id,
                chunkSize: uploadedFile.chunkSize,
                contentType: uploadedFile.contentType,
                filename: uploadedFile.filename,
                length: uploadedFile.length,
                uploadDate: uploadedFile.uploadDate,
            };

            // Update event with new file metadata
            event.fileId = fileMetadata._id;

            // Construct the image URL based on the file _id
            const imageUrl = `https://eventticketbooking-cy6o.onrender.com/file/retrieve/${newFileName}`;
            event.imageUrl = imageUrl;

            // Save the updated event with the new file information
            await event.save();
        }

        // Handle optional updates for eventFeatures and eventTags
        if (updatedEventData.eventFeatures !== undefined) {
            event.eventFeatures = typeof updatedEventData.eventFeatures === 'string'
                ? updatedEventData.eventFeatures.split(',').map((feature) => feature.trim())
                : updatedEventData.eventFeatures;
        }

        if (updatedEventData.eventTags !== undefined) {
            event.eventTags = typeof updatedEventData.eventTags === 'string'
                ? updatedEventData.eventTags.split(',').map((tag) => tag.trim())
                : updatedEventData.eventTags;
        }

        // Update other fields dynamically
        for (const key of Object.keys(updatedEventData)) {
            if (!['eventFeatures', 'eventTags'].includes(key)) {
                event[key] = updatedEventData[key];
            }
        }

        await event.save();

        // Respond with the updated event data
        res.status(200).json({
            event,
            message: req.file ? 'Event updated with new image successfully!' : 'Event updated successfully!',
        });
    } catch (err) {
        console.error('Error updating event:', err);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        if (client) {
            await client.close(); // Close MongoDB connection after the operation
        }
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

