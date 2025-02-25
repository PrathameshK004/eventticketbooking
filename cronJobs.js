const cron = require('node-cron');
const mongoose = require('mongoose');
const { GridFSBucket } = require('mongodb');
const moment = require('moment');
const ObjectId = require('mongoose').Types.ObjectId;

const Event = require('./modules/event.module.js'); // Event with startTime
const User = require('./modules/user.module.js');
const Enquiry = require('./modules/enquiry.module.js'); // 1 month old
const Notification = require('./modules/notification.module.js'); // 10 days old
const Token = require('./modules/token.module.js'); // If expired

// Initialize GridFSBuckets for different collections
let eventBucket, enquiryBucket;

const conn = mongoose.connection;
conn.once('open', () => {
    eventBucket = new GridFSBucket(conn.db, { bucketName: 'uploads' }); // For event files
    enquiryBucket = new GridFSBucket(conn.db, { bucketName: 'enquiryUploads' }); // For enquiry files
});

// Function to delete expired tokens
async function deleteExpiredTokens() {
    try {
        const result = await Token.deleteMany({ expiresAt: { $lt: new Date() } });
        console.log(`Deleted expired tokens: ${result.deletedCount}`);
    } catch (err) {
        console.error('Error deleting expired tokens:', err);
    }
}

// Function to delete past events
async function deletePastEvents() {
    try {
        const pastEvents = await Event.find(); // Fetch all events

        const now = new Date(); // Current date and time

        for (const event of pastEvents) {
            if (!event.eventTime || !event.eventDate) continue; // Skip if missing data

            // Extract the start time (first part before "-")
            const startTimeStr = event.eventTime.split('-')[0].trim(); // "HH:MM AM/PM"

            // Convert eventDate (ISO format) + startTime into a full DateTime object
            const eventDateTime = moment(event.eventDate).format('YYYY-MM-DD') + ' ' + startTimeStr;
            const eventFullDateTime = moment(eventDateTime, 'YYYY-MM-DD hh:mm A').toDate();

            // Check if event is in the past
            if (eventFullDateTime < now) {
                // Delete associated files from the "uploads" bucket
                if (event.fileId) {
                    await eventBucket.delete(new ObjectId(event.fileId));
                }

                // Remove event references from User collection
                await User.updateMany({ eventId: event._id }, { $pull: { eventId: event._id } });

                // Delete the event itself
                await Event.deleteOne({ _id: event._id });

                console.log(`Deleted event: ${event._id}`);
            }
        }

    } catch (err) {
        console.error('Error deleting past events:', err);
    }
}


// Function to delete old enquiries (older than 1 month)
async function deleteOldEnquiries() {
    try {
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

        const oldEnquiries = await Enquiry.find({ createdAt: { $lt: oneMonthAgo } });

        for (const enquiry of oldEnquiries) {
            // Delete associated files from the "enquiryUploads" bucket
            if (enquiry.fileId) {
                await enquiryBucket.delete(new ObjectId(enquiry.fileId));
            }
            await Enquiry.deleteOne({ _id: enquiry._id });
        }

        console.log(`Deleted old enquiries: ${oldEnquiries.length}`);
    } catch (err) {
        console.error('Error deleting old enquiries:', err);
    }
}

// Function to delete old notifications (older than 10 days)
async function deleteOldNotifications() {
    try {
        const tenDaysAgo = new Date();
        tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

        const result = await Notification.deleteMany({ createdAt: { $lt: tenDaysAgo } });

        console.log(`Deleted old notifications: ${result.deletedCount}`);
    } catch (err) {
        console.error('Error deleting old notifications:', err);
    }
}

// Function to schedule all deletions
async function scheduleDataDeletion() {
    await deleteExpiredTokens();
    await deletePastEvents();
    await deleteOldEnquiries();
    await deleteOldNotifications();
}

// Run cleanup function every minute
cron.schedule('* * * * *', scheduleDataDeletion);

console.log('Cron jobs scheduled for automatic data cleanup.');
