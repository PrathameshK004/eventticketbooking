const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
    eventTitle: { type: String, required: true, trim: true },
    eventDate: { type: Date, required: true },
    eventAddress: { type: String, required: true, trim: true },
    eventOrganizer: { type: String, required: true, trim: true },
    eventPrice: { type: Number, required: true },
    imageUrl: { type: String },
    eventDescription: { type: String, required: true, trim: true },
    eventLanguage: { type: String, required: true, trim: true },
    eventRating: { type: Number, min: 0, max: 5 },
    eventCapacity: { type: Number, required: true },
    eventTime: {
        startTime: { 
            type: String, 
            required: true, 
            trim: true,
            match: /^([01]?[0-9]|2[0-3]):([0-5]?[0-9])$/, 
        },
        endTime: { 
            type: String, 
            required: true, 
            trim: true,
            match: /^([01]?[0-9]|2[0-3]):([0-5]?[0-9])$/, 
        }
    },
    eventFeatures: [{ type: String, trim: true }], 
    eventTags: [{ type: String, trim: true }],
    eventOrgInsta: { type: String, trim: true },
    eventOrgX: { type: String, trim: true },
    eventOrgFacebook: { type: String, trim: true },
    userId: { type: String, required: true },
    fileId: {type: String },
    totalAmount: {type: Number}
}, { versionKey: false });

// Middleware to handle combined event date and time
eventSchema.pre('save', function(next) {
    // Get the eventDate and eventTime (startTime and endTime)
    const event = this;

    // Combine eventDate with endTime for the end dateTime
    const endDateTime = new Date(event.eventDate);
    const [endHours, endMinutes] = event.eventTime.endTime.split(':');
    endDateTime.setHours(parseInt(endHours, 10));
    endDateTime.setMinutes(parseInt(endMinutes, 10));

    // Update the eventDate with endDateTime (the final end date-time of the event)
    event.eventDate = endDateTime;

    next();
});


const Event = mongoose.model('Event', eventSchema);

module.exports = Event;