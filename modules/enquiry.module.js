const mongoose = require('mongoose');

const EnquirySchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, required: true, enum: ['Organizer Request', 'Event Request', 'Other'] },
    message: { type: String },
    status: { type: String, default: 'Pending', enum: ['Pending', 'Accepted', 'Rejected'] },
    createdAt: { type: Date, default: Date.now },
    fileId: {type: String},
    imageUrl: {type: String}
});

module.exports = mongoose.model('Enquiry', EnquirySchema);