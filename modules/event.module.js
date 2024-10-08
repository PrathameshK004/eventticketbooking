const mongoose = require('mongoose');

const eventSchema = mongoose.Schema({
    eventTitle:{type:String},
    eventDate:{type:Date},
    eventAddress:{type:String},
    eventOrganizer:{type:String},
    imageUrl:{type:String},
    eventPrice:{type: Number},
    eventDescription:{type:String}
    
});

eventSchema.virtual('formattedEventDate').get(function() {
    const date = this.eventDate;
    if (!date) return null;
    
    // Format to YYYY-MM-DD
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-based
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
});

// Set the schema
const Event = mongoose.model('Event', eventSchema);

module.exports= Event;