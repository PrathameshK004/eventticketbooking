// const express = require('express');
// const bodyParser=require('body-parser')
// const mongoose=require('mongoose');
// const app = express();
// app.use(bodyParser.json());
// module.exports = {
//     validateEventId: validateEventId,
//     validateNewEvent:validateNewEvent
// }

// function isUuidValid(eventId) {
  
//   return mongoose.Types.ObjectId.isValid(eventId);
// }

// function validateEventId(req, res, next) {
//   const eventId = req.params.eventId;

//   if (!isUuidValid(eventId)) {
//       return res.status(400).json({ error: 'Invalid eventId. Please provide a valid UUID.' });
//   }

//   next();
// }
// function validateNewEvent(req, res, next) {
//   const { eventTitle, eventDate, eventAddress, eventOrganizer, eventPrice} = req.body;

//   if (!eventTitle || !eventDate || !eventAddress || !eventOrganizer || !eventPrice) {
//       return res.status(400).json({ error: 'Event title, date, address, price and organizer are required fields.' });
//   }

//   next();
// }

const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const app = express();
app.use(bodyParser.json());

module.exports = {
    validateEventId,
    validateNewEvent
};

function isUuidValid(eventId) {
    return mongoose.Types.ObjectId.isValid(eventId);
}

function validateEventId(req, res, next) {
    const eventId = req.params.eventId;

    if (!isUuidValid(eventId)) {
        return res.status(400).json({ error: 'Invalid eventId. Please provide a valid UUID.' });
    }

    next();
}

function validateNewEvent(req, res, next) {
    const {
        eventTitle,
        eventDate,
        eventAddress,
        eventOrganizer,
        eventPrice,
        eventDescription,
        eventLanguage,
        eventRating,
        eventCapacity,
        eventDuration,
        eventFeatures,
        eventTags
    } = req.body;

    // Check required fields
    if (!eventTitle || !eventDate || !eventAddress || !eventOrganizer || !eventPrice || !eventLanguage || !eventDescription || !eventDuration || !eventCapacity) {
        return res.status(400).json({ error: 'Event title, date, address, price, language, description, duration, capacity and organizer are required fields.' });
    }

    if (eventRating !== undefined && (eventRating < 0 || eventRating > 5)) {
        return res.status(400).json({ error: 'Event rating must be between 0 and 5.' });
    }

    if (eventCapacity !== undefined && eventCapacity < 1) {
        return res.status(400).json({ error: 'Event capacity can not be less than 1.' });
    }

    if (!/^\d+\s+(hours?|minutes?)$/.test(eventDuration)) {
      return res.status(400).json({ error: `${eventDuration} is not a valid duration format! Use "X hours" or "Y minutes".` });
  }

    if (eventFeatures && !Array.isArray(eventFeatures)) {
        return res.status(400).json({ error: 'Event features must be an array.' });
    }

    if (eventTags && !Array.isArray(eventTags)) {
        return res.status(400).json({ error: 'Event tags must be an array.' });
    }

    next();
}
