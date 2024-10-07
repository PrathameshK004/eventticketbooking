const express = require('express');
const bodyParser=require('body-parser')
const mongoose=require('mongoose');
const app = express();
app.use(bodyParser.json());
module.exports = {
    validateEventId: validateEventId,
    validateNewEvent:validateNewEvent
}

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
  const { eventTitle, eventDate, eventAddress, eventOrganizer } = req.body;

  if (!eventTitle || !eventDate || !eventAddress || !eventOrganizer) {
      return res.status(400).json({ error: 'Event title, date, address, and organizer are required fields.' });
  }

  next();
}