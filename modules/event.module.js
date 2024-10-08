const mongoose = require('mongoose');

const event = mongoose.model('event',{
    eventTitle: { type: String },
    eventDate: { type: String },
    eventAddress: { type: String },
    eventOrganizer: { type: String },
    imageUrl: { type: String },
    eventPrice: { type: Number },
    eventDescription: { type: String }
});



module.exports = event;
