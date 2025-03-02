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
        
        // Current time in UTC
        const nowUTC = new Date();
        
        // Convert to IST by adding 5 hours and 30 minutes
        const nowIST = new Date(nowUTC.getTime() + (5.5 * 60 * 60 * 1000));
        
        console.log(`Current time (UTC): ${nowUTC.toISOString()}`);
        console.log(`Current time (IST): ${nowIST.toISOString()} (${nowIST.toString()})`);

        for (const event of pastEvents) {
            if (!event.eventTime || !event.eventDate) {
                console.log(`Skipping event ${event._id}: Missing eventTime or eventDate`);
                continue;
            }

            // Extract the start time and end time
            const timeComponents = event.eventTime.split('-');
            if (timeComponents.length !== 2) {
                console.log(`Skipping event ${event._id}: Invalid time format ${event.eventTime}`);
                continue;
            }

            const startTimeStr = timeComponents[0].trim();
            const endTimeStr = timeComponents[1].trim();

            // Parse dates in IST context
            const eventDateStr = moment(event.eventDate).format('YYYY-MM-DD');
            
            // Create moment objects - assuming these times are already in IST
            const eventStartMoment = moment(`${eventDateStr} ${startTimeStr}`, 'YYYY-MM-DD hh:mm A');
            const eventEndMoment = moment(`${eventDateStr} ${endTimeStr}`, 'YYYY-MM-DD hh:mm A');
            
            if (!eventStartMoment.isValid() || !eventEndMoment.isValid()) {
                console.log(`Skipping event ${event._id}: Invalid date/time conversion`);
                console.log(`  Date: ${eventDateStr}, Start: ${startTimeStr}, End: ${endTimeStr}`);
                continue;
            }
            
            // IMPORTANT: Convert from IST to UTC for proper storage
            // But for comparison purposes, we'll use IST times directly
            const eventFullDateStartTime = eventStartMoment.toDate();
            const eventFullDateEndTime = eventEndMoment.toDate();
            
            console.log(`Event ${event._id}: ${event.eventTitle}`);
            console.log(`  isLive: ${event.isLive}`);
            console.log(`  Start (IST): ${eventFullDateStartTime.toISOString()}`);
            console.log(`  End (IST): ${eventFullDateEndTime.toISOString()}`);
            console.log(`  Now (IST): ${nowIST.toISOString()}`);
            
            // Compare using IST times
            const startPassed = eventFullDateStartTime <= nowIST;
            console.log(`  Start passed in IST? ${startPassed}`);

            // If event is live and start time has passed in IST, mark as not live
            if (event.isLive && startPassed) {
                console.log(`  Marking event ${event._id} as not live (IST comparison)`);
                await Event.updateOne({ _id: event._id }, { $set: { isLive: false } });
                console.log(`  Successfully marked event ${event._id} as not live`);
                event.isLive = false;
            }

            // Process hold amount refund logic - also using IST time
            if (!event.isLive && eventFullDateEndTime <= nowIST && event.holdAmount > 0) {
                console.log(`  Processing refund for event ${event._id}`);
                const refundAmount = event.holdAmount;
                
                let wallet = await Wallet.findOne({ userId: event.userId });
                if (!wallet) {
                    console.error(`  Wallet not found for user ${event.userId}`);
                    continue;
                }
                
                // Record transaction in wallet
                wallet.balance += refundAmount;
                wallet.transactions.push({
                    amount: refundAmount,
                    type: 'Credit',
                    description: `Release of hold balance of event: ${event.eventTitle}`
                });
                await wallet.save();
                console.log(`  Credited ${refundAmount} to user ${event.userId}'s wallet`);

                event.holdAmount = 0;
                await event.save();
            }

            // Add 30 days (1 month) to the event date for deletion threshold - in IST
            const deletionThreshold = moment(eventFullDateEndTime).add(30, 'days').toDate();
            console.log(`  Deletion threshold (IST): ${deletionThreshold.toISOString()}`);
            console.log(`  Ready for deletion in IST? ${deletionThreshold < nowIST}`);

            // Check if the event is now older than 30 days after end time - in IST
            if (deletionThreshold < nowIST) {
                console.log(`  Deleting event ${event._id}`);
                
                // Delete associated files
                if (event.fileId) {
                    try {
                        await eventBucket.delete(new ObjectId(event.fileId));
                        console.log(`  Deleted file ${event.fileId}`);
                    } catch (fileErr) {
                        console.error(`  Error deleting file ${event.fileId}:`, fileErr);
                    }
                }

                // Remove event references from User collection
                try {
                    const userUpdateResult = await User.updateMany(
                        { eventId: event._id }, 
                        { $pull: { eventId: event._id } }
                    );
                    console.log(`  Updated ${userUpdateResult.nModified} users`);
                } catch (userErr) {
                    console.error(`  Error updating users:`, userErr);
                }

                // Delete admin notification
                try {
                    const eventDetailsId = new ObjectId(event._id);
                    const adminNoti = await AdminNotification.findOne({ eventDetails: eventDetailsId });

                    if (adminNoti) {
                        await AdminNotification.findByIdAndDelete(adminNoti._id);
                        console.log(`  Deleted admin notification ${adminNoti._id}`);
                    } else {
                        console.log(`  No admin notification found for event ${event._id}`);
                    }
                } catch (notiErr) {
                    console.error(`  Error handling admin notification:`, notiErr);
                }

                // Delete the event
                try {
                    const deletedEvent = await Event.findByIdAndDelete(event._id);
                    if (deletedEvent) {
                        console.log(`  Successfully deleted event ${event._id}`);
                    } else {
                        console.error(`  Failed to delete event ${event._id} (Not found)`);
                    }
                } catch (deleteErr) {
                    console.error(`  Error deleting event:`, deleteErr);
                }
            }
        }

    } catch (err) {
        console.error('Error in deletePastEvents function:', err);
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