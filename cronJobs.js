const cron = require('node-cron');
const Event = require('./modules/event.module.js');
const Wallet = require('./modules/wallet.module.js');
const User = require('./modules/user.module.js');
const Enquiry = require('./modules/enquiry.module.js');
const { GridFSBucket } = require('mongodb');
const ObjectId = require('mongoose').Types.ObjectId;
const mongoose = require('mongoose');

// Initialize GridFSBucket
let bucket;

const conn = mongoose.connection;
conn.once('open', () => {
    bucket = new GridFSBucket(conn.db, { bucketName: 'uploads' });
});

// Function to convert Date to cron format (HH:mm format)
function dateToCron(date) {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    return `${minutes} ${hours} * * *`; // Runs at the specific hour and minute of the day
}

// Function to schedule deletion of events and enquiries
async function scheduleDataDeletion() {
    try {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // Get today’s date (midnight)

        // Find events happening today
        const events = await Event.find({
            eventDate: { $gte: today },
            eventTime: { $exists: true }
        });

        events.forEach(event => {
            const eventStartTime = new Date(`${event.eventDate.toISOString().split('T')[0]}T${event.eventTime.startTime}:00`);
            const timeDifference = eventStartTime - now; // Time difference in milliseconds

            if (timeDifference > 0) {
                // Schedule a task to delete the event at its start time
                const cronPattern = dateToCron(eventStartTime); // Convert Date to cron pattern
                cron.schedule(cronPattern, async () => {
                    try {
                        // Fetch the organizer's wallet using userId
                        const wallet = await Wallet.findOne({ userId: event.userId });
                        if (!wallet) {
                            console.error(`Wallet for organizer ${event.userId} not found.`);
                            return;
                        }

                        // Credit the event's totalAmount to the organizer's wallet
                        wallet.balance += event.totalAmount;

                        // Record the transaction in the wallet
                        wallet.transactions.push({
                            amount: event.totalAmount,
                            type: 'Credit',
                            description: `Event payment for "${event.eventTitle}" credited at event start time.`
                        });

                        // Save the updated wallet
                        await wallet.save();

                        // Delete the event after updating the wallet
                        const eventDel = await Event.deleteOne({ _id: event._id });
                        if (eventDel.fileId) {
                            await bucket.delete(new ObjectId(eventDel.fileId));
                        }
                        console.log(`Event "${event.eventTitle}" deleted and payment credited`);

                        // Fetch the user (organizer)
                        const user = await User.findById(event.userId);
                        if (user) {
                            // Remove the event ID from the user's event list
                            await User.updateOne(
                                { _id: event.userId },
                                { $pull: { eventId: event._id } } // Assuming `eventId` is the array of event references in the user schema
                            );
                            console.log(`Event "${event.eventTitle}" removed from user ${user._id}'s event list.`);
                        }
                    } catch (error) {
                        console.error('Error processing event payment or deletion:', error);
                    }
                });
            }
        });

        // Find Enquiries created more than 3 days ago
        const threeDaysAgo = new Date(now);
        threeDaysAgo.setDate(now.getDate() - 5);

        // Directly delete enquiries older than 3 days
        const result = await Enquiry.deleteMany({
            createdAt: { $lt: threeDaysAgo }
        });

        console.log(`Deleted ${result.deletedCount} enquiries older than 5 days.`);

    } catch (error) {
        console.error('Error scheduling event deletions or enquiry deletions:', error);
    }
}

// Call the function to schedule deletions
scheduleDataDeletion();

// Schedule the deletion check every minute
cron.schedule('* * * * *', scheduleDataDeletion);
