const cron = require('node-cron');
const Booking = require('../modules/bookingdetails.module.js');
const Event = require('../modules/event.module.js');

// Schedule a task to run every minute
cron.schedule('* * * * *', async () => {
    try {
        const currentDate = new Date();

        // Get midnight of today in UTC (00:00:00 UTC)
        const formattedDate = new Date(currentDate);
        formattedDate.setHours(0, 0, 0, 0); // Set to today's midnight in UTC (00:00:00 UTC)

        // Apply IST offset (UTC + 5:30)
        const IST_OFFSET = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
        const istMidnight = new Date(formattedDate.getTime() + IST_OFFSET); // Midnight IST for today
        
        // Now calculate midnight IST for the next day
        const nextDayMidnightIST = new Date(istMidnight);
        nextDayMidnightIST.setDate(istMidnight.getDate() + 1); // Move to the next day
        
        // Step 1: Update bookings that are past the current date and have 'Booked' status
        const bookingsToUpdate = await Booking.find({
            eventDate: { $lt: nextDayMidnightIST }, // Only those before the next day's midnight IST
            status: 'Booked' // Only get bookings with status 'Booked'
        });

        for (const booking of bookingsToUpdate) {
            booking.status = 'Completed';
            await booking.save();
        }

        // Step 2: Delete events that occurred before the next day's midnight IST
        const eventsToDelete = await Event.find({
            eventDate: { $lt: nextDayMidnightIST } // Only events before the next day's midnight IST
        });

        if (eventsToDelete.length > 0) {
            const eventIdsToDelete = eventsToDelete.map(event => event._id);
            await Event.deleteMany({ _id: { $in: eventIdsToDelete } });
            console.log(`Deleted ${eventsToDelete.length} past events.`);
        } else {
            console.log('No past events to delete.');
        }

    } catch (err) {
        console.error('Error updating bookings or deleting events:', err);
    }
});
