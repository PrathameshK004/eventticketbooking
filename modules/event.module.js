const mongoose = require('mongoose');

const event = mongoose.model('event',{
    eventTitle:{type:String},
    eventDate:{type:Date},
    eventAddress:{type:String},
    eventOrganizer:{type:String},
    imageUrl:{type:String},
    eventDescription:{type:String}
    
});

module.exports= event;