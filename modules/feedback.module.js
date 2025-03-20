const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
    rating: { type: Number, min: 0.5, max: 5},
    userId: { type: String, required: true },
    bookingId: { type: String, required: true },
    eventId: { type: String, required: true },
    status: { type: String, enum: ["Pending", "Completed"], default: "Pending" },
    createdAt: { type: Date, default: Date.now }
});

const Feedback = mongoose.model('Feedback', feedbackSchema);

module.exports = Feedback;
