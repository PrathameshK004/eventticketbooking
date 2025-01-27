const mongoose = require('mongoose');

const EnquirySchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String},
    type: { type: String, required: true, enum: ['Organizer Request', 'Event Request', 'Other'] },
    message: { type: String },
    status: { type: String, default: 'Pending', enum: ['Pending', 'Accepted', 'Rejected'] },
    createdAt: { type: Date, default: Date.now },
    fileId: {type: String},
    imageUrl: {type: String},
    remarks: {type: String}
});


// Automatically fetch and store the userName based on userId
EnquirySchema.pre('save', async function (next) {
    if (this.isNew || this.isModified('userId')) {
        const User = mongoose.model('User'); // Ensure you have the User model
        const user = await User.findById(this.userId);
        if (user) {
            this.userName = user.userName; // Assuming 'userName' is the correct field in your User model
        }
    }
    next();
});

module.exports = mongoose.model('Enquiry', EnquirySchema);