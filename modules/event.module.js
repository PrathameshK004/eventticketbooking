const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
    eventTitle: { type: String },
    eventDate: { type: Date },
    eventAddress: { type: String },
    eventOrganizer: { type: String },
    imageUrl: { type: String },
    eventPrice: { type: Number },
    eventDescription: { type: String }
});

// Override toJSON method to format the eventDate when sending data out
eventSchema.methods.toJSON = function() {
    const event = this.toObject();
    event.eventDate = event.eventDate.toISOString().split('T')[0]; // Format date as YYYY-MM-DD
    return event;
};

const Event = mongoose.model('Event', eventSchema);

module.exports = Event;
