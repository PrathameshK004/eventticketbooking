const express = require('express');

const router = express.Router();
const Event = require('../modules/event.module.js');
const ObjectId=require('mongoose').Types.ObjectId;

module.exports = {
    getAllEvents: getAllEvents,
    getEventById: getEventById,
    createEvent: createEvent,
    updateEvent: updateEvent,
    deleteEvent: deleteEvent,
    searchEventsByKeyword: searchEventsByKeyword
}

function getAllEvents(req, res) {
    Event.find()
        .then(events => res.status(200).json(events))
        .catch(err => {
            console.error(err.message);
            res.status(500).json({ error: 'Failed to fetch events' });
        });
}

async function getEventById(req, res) {
    let eventId = req.params.eventId;
    
    try {
        let event = await Event.findById(eventId);
    
        if (!event) {
            return res.status(404).json({ message: "Event not found" });
        }

        res.status(200).json(event);
    } catch (err) {
        console.error("Internal server error:", err.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
}


async function createEvent(req, res) {
    const eventDetails = req.body;
   
    newEvent = await Event.create(eventDetails);

    res.status(201).json(newEvent);
}



async function updateEvent(req, res) {
    const eventId = req.params.eventId; 

    const updatedEventData = req.body; 
    try {
        const event = await Event.findById(eventId); 

        if (!event) {
            return res.status(404).json({ error: 'Event not found' }); 
        }

        
        event.eventTitle = updatedEventData.eventTitle || event.eventTitle;
        event.eventDate = updatedEventData.eventDate || event.eventDate;
        event.eventAddress = updatedEventData.eventAddress || event.eventAddress;
        event.eventOrganizer = updatedEventData.eventOrganizer || event.eventOrganizer;
        event.imageUrl = updatedEventData.imageUrl || event.imageUrl;
        event.eventDescription = updatedEventData.eventDescription || event.eventDescription;

        await event.save();

        res.status(200).json(event); 
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
}


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



async function searchEventsByKeyword(req, res) {
    try {
        const keyword = req.query.q;  // 'q' is the query parameter

        if (!keyword) {
            return res.status(400).json({ error: 'Please provide a keyword to search for.' });
        }

        const events = await Event.find({
            $or: [
                { eventTitle: { $regex: keyword, $options: 'i' } },
                { eventAddress: { $regex: keyword, $options: 'i' } },
                { eventOrganizer: { $regex: keyword, $options: 'i' } }
            ]
        });

        if (events.length === 0) {
            return res.status(404).json({ message: 'No events found matching the keyword.' });
        }

        res.status(200).json(events);
    } catch (error) {
        res.status(500).json({ error: 'Error occurred while searching for events.' });
    }
}
