const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const Event = require('../modules/event.module');
const User = require('../modules/user.module');  // Import the User model

const bookingDetailsSchema = new mongoose.Schema({
    userId: { type: String },
    eventId: { type: String }, 
    bookedBy: { type: String },
    userEmail: { type: String },  // Email field
    eventTitle: { type: String },
    eventDate: { type: Date },
    bookingDate: { type: Date, default: Date.now },
    noOfPeople: { type: Number },
    nameOfPeople: { type: [String] },
    totalAmount: { type: Number },
    status: { 
        type: String, 
        enum: ['Booked', 'Cancelled', 'Completed'], 
        default: 'Booked' 
    }
});

// Middleware to populate event details and bookedBy/userEmail field on save
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

    if (this.isModified('userId')) {
        const user = await User.findById(this.userId);
        if (user) {
            this.bookedBy = user.userName;  // Set bookedBy with the user's name
            this.userEmail = user.emailID;     // Set userEmail with the user's email
        } else {
            return next(new Error('User not found'));
        }
    }

    next();
});

// Customize toJSON to format bookingDate
bookingDetailsSchema.methods.toJSON = function() {
    const bookingdetails = this.toObject();
    bookingdetails.bookingDate = bookingdetails.bookingDate.toISOString().split('T')[0];
    return bookingdetails;
};

const BookingDetails = mongoose.model('BookingDetails', bookingDetailsSchema);
module.exports = BookingDetails;
