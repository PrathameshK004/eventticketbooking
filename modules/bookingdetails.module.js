const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const Event = require('../modules/event.module');
const User = require('../modules/user.module');  // Import the User model

const bookingDetailsSchema = new mongoose.Schema({
    userId: { type: String },//*
    eventId: { type: String }, //*
    customer_name: { type: String },
    eventTitle: { type: String },
    eventDate: { type: Date },
    bookingDate: { type: Date, default: Date.now },
    noOfPeoples: { 
        type: [Number], // Define as an array of numbers
        validate: {
            validator: function(value) {
                // Ensure the array has exactly 3 elements
                return Array.isArray(value) && value.length === 3;
            },
            message: "noOfPeoples must be an array with exactly 3 values."
        }
    }, //*
    totalAmount: { type: Number }, //*
    transactionId: {type: String},
    pay_status: { 
        type: String, 
        enum: ['Successful']
    }, //*
    book_status: { 
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
            this.customer_name = user.userName;  // Set bookedBy with the user's name
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
