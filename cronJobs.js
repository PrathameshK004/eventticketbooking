const cron = require('node-cron');
const Event = require('./modules/event.module.js');
const Wallet = require('./modules/wallet.module.js'); 
const User = require('./modules/user.module.js'); 

// Function to schedule deletion of events
async function scheduleEventDeletion() {
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
                cron.schedule(new Date(eventStartTime), async () => {
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
                        await Event.deleteOne({ _id: event._id });
                        console.log(`Event "${event.eventTitle}" deleted and payment credited`);

                        // Fetch the user (organizer)
                        const user = await User.findById( event.userId );
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
    } catch (error) {
        console.error('Error scheduling event deletions:', error);
    }
}

// Call the function to schedule deletions
scheduleEventDeletion();

// Schedule the deletion check every minute
cron.schedule('* * * * *', scheduleEventDeletion);
