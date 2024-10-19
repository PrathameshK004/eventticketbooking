const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const app = express();
const Event = require('../modules/event.module'); 
app.use(bodyParser.json());

module.exports = {
  validateEventId,
  validateNewEvent,
  validateUpdateEvent
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

function validateEventData(eventData, isUpdate = false) {
  const errors = [];

  const requiredFields = ['eventTitle', 'eventDate', 'eventAddress', 'eventOrganizer', 'eventPrice', 'eventLanguage', 'eventDescription', 'eventDuration', 'eventCapacity'];
  
  requiredFields.forEach(field => {
    if (!isUpdate && !eventData[field]) {
      errors.push(`${field} is required.`);
    }
  });

  if (eventData.eventRating !== undefined && (eventData.eventRating < 0 || eventData.eventRating > 5)) {
    errors.push('Event rating must be between 0 and 5.');
  }

  if (eventData.eventCapacity !== undefined && eventData.eventCapacity < 1) {
    errors.push('Event capacity cannot be less than 1.');
  }

  if (eventData.eventDuration && !/^\d+\s+(hours?|minutes?)$/.test(eventData.eventDuration)) {
    errors.push(`${eventData.eventDuration} is not a valid duration format! Use "X hours" or "Y minutes".`);
  }

  if (eventData.eventFeatures && !Array.isArray(eventData.eventFeatures)) {
    errors.push('Event features must be an array.');
  }

  if (eventData.eventTags && !Array.isArray(eventData.eventTags)) {
    errors.push('Event tags must be an array.');
  }

  return errors;
}

async function checkExistingEvent(eventData, excludeId = null) {
  const query = {
    eventTitle: eventData.eventTitle,
    eventDate: new Date(eventData.eventDate),
    eventAddress: eventData.eventAddress,
    eventOrganizer: eventData.eventOrganizer
  };

  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  return await Event.findOne(query);
}

async function validateNewEvent(req, res, next) {
  const eventData = req.body;
  const errors = validateEventData(eventData);

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  try {
    const existingEvent = await checkExistingEvent(eventData);
    if (existingEvent) {
      return res.status(409).json({ error: 'A similar event already exists. Duplicate events are not allowed.' });
    }
  } catch (error) {
    return res.status(500).json({ error: 'Error checking for existing events.' });
  }

  next();
}

async function validateUpdateEvent(req, res, next) {
  const eventId = req.params.eventId;

  if (!isUuidValid(eventId)) {
    return res.status(400).json({ error: 'Invalid eventId. Please provide a valid UUID.' });
  }

  const eventData = req.body;
  const errors = validateEventData(eventData, true);

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  try {
    const existingEvent = await checkExistingEvent(eventData, eventId);
    if (existingEvent) {
      return res.status(409).json({ error: 'Updating this event would create a duplicate. Update not allowed.' });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ error: 'Event not found.' });
    }

    // Update the event with new data
    Object.assign(event, eventData);
    await event.save();

    req.updatedEvent = event;
    next();
  } catch (error) {
    return res.status(500).json({ error: 'Error updating event.' });
  }
}