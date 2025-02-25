const mongoose = require("mongoose");
const Event = require('../modules/event.module');
const { ServerDescriptionChangedEvent } = require("mongodb");

const adminNotificationSchema = new mongoose.Schema({
    type: { type: String, required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    eventDetails: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
    status: { type: String, default: 'Pending', enum: ['Pending', 'Accepted', 'Rejected'] },
    remarks: { type: String },
    userId: { type: String }
});


const AdminNotification = mongoose.model('AdminNotification', adminNotificationSchema);

module.exports = AdminNotification;