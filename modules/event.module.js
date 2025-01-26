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
    eventDuration: { 
        type: String, 
        required: true, 
        trim: true,
        validate: {
            validator: function(value) {
                return /^\d+\s+(hours?|minutes?)$/.test(value);
            },
            message: props => `${props.value} is not a valid duration format! Use "X hours" or "Y minutes".`
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

eventSchema.methods.toJSON = function() {
    const event = this.toObject();
    event.eventDate = event.eventDate.toISOString().split('T')[0]; // Format date as YYYY-MM-DD
    return event;
};
const Event = mongoose.model('Event', eventSchema);

module.exports = Event;