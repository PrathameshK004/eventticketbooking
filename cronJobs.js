const cron = require('node-cron');
const mongoose = require('mongoose');
const { GridFSBucket } = require('mongodb');
const moment = require('moment');
const ObjectId = require('mongoose').Types.ObjectId;
const AdminNotification = require('./modules/adminNotification.module.js'); // 10 days old
const Event = require('./modules/event.module.js'); // isLive to false with startTime and delete 1 month
const User = require('./modules/user.module.js');
const Wallet = require('./modules/wallet.module.js');
const Enquiry = require('./modules/enquiry.module.js'); // 1 month old
const Notification = require('./modules/notification.module.js'); // 10 days old
const Token = require('./modules/token.module.js'); // If expired
const Coupon = require('./modules/coupon.module.js'); // If expired
const Reward = require('./modules/reward.module.js'); // If expired

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

// Function to delete expired coupons
async function deleteExpiredCoupons() {
    try {
        const result = await Coupon.deleteMany({ expirationDate: { $lt: new Date() } });
        console.log(`Deleted expired coupons: ${result.deletedCount}`);
    } catch (err) {
        console.error('Error deleting expired coupons:', err);
    }
}

// Function to delete expired rewards
async function deleteExpiredRewards() {
    try {
        const result = await Reward.deleteMany({ expiresAt: { $lt: new Date() } });
        console.log(`Deleted expired rewards: ${result.deletedCount}`);
    } catch (err) {
        console.error('Error deleting expired rewards:', err);
    }
}

// Function to update lose rewards
async function updateLoseRewards() {
    try {
        const result = await Reward.updateMany(
            { isRevealed: true, type: 'lose', isRedeemed: false },
            { $set: { isRedeemed: true } }
        );
        console.log(`Updated revealed lose rewards to redeemed: ${result.nModified}`);
    } catch (err) {
        console.error('Error updating lose rewards:', err);
    }
}


async function deletePastEvents() {
    try {
        const pastEvents = await Event.find(); // Fetch all events

        const now = new Date(); // Current date and time

        for (const event of pastEvents) {
            if (!event.eventTime || !event.eventDate) continue; // Skip if missing data

            const [startTimeStr, endTimeStr] = event.eventTime.split('-').map(time => time.trim());

            // Convert eventDate + startTime into a full DateTime object
            const eventDateStr = moment(event.eventDate).format('YYYY-MM-DD');
            const eventStartDateTime = moment(`${eventDateStr} ${startTimeStr}`, 'YYYY-MM-DD hh:mm A').toDate();
            const eventEndDateTime = moment(`${eventDateStr} ${endTimeStr}`, 'YYYY-MM-DD hh:mm A').toDate();

            if (event.isLive && eventStartDateTime <= now) {
                await Event.updateOne({ _id: event._id }, { $set: { isLive: false } });
                console.log(`Marked event ${event._id} as not live`);
            }

            if (!event.isLive && eventEndDateTime <= now) {
                const refundAmount = event.holdAmount;
                let wallet = await Wallet.findOne({ userId: event.userId });
                if (!wallet) {
                    return res.status(404).json({ error: 'Wallet not found for the user' });
                }
                // Record transaction in wallet
                wallet.balance += refundAmount;
                wallet.transactions.push({
                    amount: refundAmount,
                    type: 'Credit',
                    description: `Release of hold balance of event: ${event.eventTitle}`
                });
                await wallet.save();
                console.log(`Credited ${refundAmount} to user ${event.userId}'s wallet`);

                event.holdAmount = 0;
                await event.save();
            }


            // Add 30 days (1 month) to the event date
            const deletionThreshold = moment(eventStartDateTime).add(30, 'days').toDate();

            // Check if the event is now older than 30 days
            if (deletionThreshold < now) {
                // Delete associated files from the "uploads" bucket
                if (event.fileId) {
                    await eventBucket.delete(new ObjectId(event.fileId));
                }

                // Remove event references from User collection
                await User.updateMany({ eventId: event._id }, { $pull: { eventId: event._id } });

                const eventDetailsId = new ObjectId(event._id);

                const adminNoti = await AdminNotification.findOne({ eventDetails: eventDetailsId });

                if (adminNoti) {
                    await AdminNotification.findByIdAndDelete(adminNoti._id);
                }
                else {
                    console.warn(`Skipping event ${event._id}: eventDetails is missing or malformed`, event.eventDetails);
                }

                const deletedEvent = await Event.findByIdAndDelete(event._id);

                if (deletedEvent) {
                    console.log(`Deleted event: ${event._id}`);
                } else {
                    console.error(`Failed to delete event: ${event._id} (Not found)`);
                }

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
    await deleteExpiredCoupons();
    await deleteExpiredRewards();
    await updateLoseRewards();
}

// Run cleanup function every minute
cron.schedule('* * * * *', scheduleDataDeletion);

console.log('Cron jobs scheduled for automatic data cleanup.');
