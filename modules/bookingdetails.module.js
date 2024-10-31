const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const Event = require('../modules/event.module'); 

const bookingDetailsSchema = new mongoose.Schema({
    userId: { type: String },
    eventId: { type: String }, 
    eventTitle: { type: String },
    eventDate: { type: Date },
    bookingDate: { type: Date, default: Date.now },
    noOfPeople: { type: Number },
    totalAmount: { type: Number},
    status: { 
        type: String, 
        enum: ['Booked', 'Cancelled', 'Completed'], 
        default: 'Booked' 
    }
});


bookingDetailsSchema.pre('save', async function (next) {
    if (this.isModified('eventId')) {
        const event = await Event.findById(this.eventId);
        if (event) {
            this.eventTitle = event.eventTitle; 
            this.eventDate = event.eventDate;   
        } else {
            return next(new Error('Event not found'));
        }
    }
    next();
});

bookingDetailsSchema.methods.toJSON = function() {
    const bookingdetails = this.toObject();
    bookingdetails.bookingDate = bookingdetails.bookingDate.toISOString().split('T')[0];

    return bookingdetails;
};

const BookingDetails = mongoose.model('BookingDetails', bookingDetailsSchema);
module.exports = BookingDetails;
