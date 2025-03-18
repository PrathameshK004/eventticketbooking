const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const app = express();
const Event = require('../modules/event.module');
const User = require('../modules/user.module');
const Token = require('../modules/token.module');

function isDateInPast(date) {
  const currentDate = new Date().toISOString().split('T')[0]; // Get current date in 'YYYY-MM-DD' format
  return new Date(date) < new Date(currentDate); // Compare the given date with the current date
}


app.use(bodyParser.json());

module.exports = {
  validateEventId,
  validateNewEvent,
  validateUpdateEvent,
  validateTokenReuse,
  validateOrgId
};

function isUuidValid(eventId) {
  return mongoose.Types.ObjectId.isValid(eventId);
}

async function validateOrgId(req, res, next) {
  const userId = req.params.userId;
  if (!userId) {
    return res.status(400).json({ error: 'User ID is required.' });
  }
  if (!isUuidValid(userId)) {
    return res.status(400).json({ error: 'Invalid userId. Please provide a valid UUID.' });
  }
  const user = await User.findById(userId);
  if (!user) {
    return res.status(400).json({ error: 'User not found.' });
  }

  if (!user.roles.includes(1)) {
    return res.status(400).json({ error: 'You are not Organizer' });
  }

  next();
}

function validateEventId(req, res, next) {
  const eventId = req.params.eventId;

  if (!isUuidValid(eventId)) {
    return res.status(400).json({ error: 'Invalid eventId. Please provide a valid UUID.' });
  }

  next();
}

function validateEventData(eventData, isUpdate = false, requiresEventOrg = false) {
  const errors = [];

  const requiredFields = ['eventTitle', 'eventDate', 'eventAddress', 'eventOrganizer', 'eventPrice', 'eventLanguage', 'eventDescription', 'eventTime', 'eventType', 'eventCapacity'];

  if (requiresEventOrg) {
    requiredFields.push('eventOrg'); // Make eventOrg required only for token-based requests
  }

  if (!isUpdate) {
    requiredFields.forEach(field => {
      if (!eventData[field]) {
        errors.push(`${field} is required.`);
      }
    });
  }

  if (eventData.eventCapacity !== undefined && eventData.eventCapacity < 1) {
    errors.push('Event capacity cannot be less than 1.');
  }

  if (
    !/^(0?[1-9]|1[0-2]):[0-5]\d (AM|PM)-(0?[1-9]|1[0-2]):[0-5]\d (AM|PM)$/.test(
      eventData.eventTime
    )
  ) {
    errors.push(
      `${eventData.eventTime} is not a valid event time format! Use "HH:MM AM/PM - HH:MM AM/PM", where hours are 01-12 and minutes are 00-59.`
    );
  }



  if (eventData.eventDate && isDateInPast(eventData.eventDate)) {
    errors.push('Event date cannot be in the past.');
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

  // Only include fields that are present in eventData
  Object.keys(query).forEach(key => {
    if (eventData[key] === undefined) {
      delete query[key];
    }
  });

  if (Object.keys(query).length === 0) {
    return null; // No need to check for duplicates if no relevant fields are being updated
  }

  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  return await Event.findOne(query);
}

async function validateNewEvent(req, res, next) {
  const eventData = req.body;
  const requiresEventOrg = !req.params.token; // True if token is NOT present in the request

  const errors = validateEventData(eventData, false, requiresEventOrg);

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  if (isDateInPast(eventData.eventDate)) {
    return res.status(400).json({ error: 'Event date cannot be in the past.' });
  }

  try {
    const existingEvent = await checkExistingEvent(eventData);
    if (existingEvent) {
      return res.status(409).json({ error: 'A similar event already exists. Duplicate events are not allowed.' });
    }
  } catch (error) {
    try {
      const token = req.params?.token;

      if (token) {
        const tokenDoc = await Token.findOne({ token });

        if (tokenDoc) {
          tokenDoc.used = false;
          await tokenDoc.save();
        }
      }
    } catch (tokenErr) {
      console.error("Error handling token:", tokenErr.message);
    }
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

  if (eventData.eventDate && isDateInPast(eventData.eventDate)) {
    return res.status(400).json({ error: 'Event date cannot be in the past.' });
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

    // Update only the fields provided in the request body
    Object.keys(eventData).forEach(key => {
      event[key] = eventData[key];
    });

    await event.save();

    req.updatedEvent = event;
    next();
  } catch (error) {
    return res.status(500).json({ error: 'Error updating event.' });
  }
}


async function validateTokenReuse(req, res, next) {
  try {
    const token = req.params.token;

    if (!token) {
      next();
    }

    const tokenDoc = await Token.findOne({ token });

    if (!tokenDoc) {
      return res.status(400).json({ message: "Invalid token" });
    }

    if (tokenDoc.used) {
      return res.status(400).json({ message: "Token has already been used" });
    }

    if (tokenDoc.expiresAt < new Date()) {
      return res.status(400).json({ message: "Token has expired" });
    }

    tokenDoc.used = true;
    await tokenDoc.save();

    next();

  } catch (error) {
    res.status(500).json({ message: "Error validating token" });
  }
}

