const cron = require('node-cron');
const Booking = require('../modules/bookingdetails.module.js');
const Event = require('../modules/event.module.js');

// Schedule a task to run every minute
cron.schedule('* * * * *', async () => {
    try {
        const currentDate = new Date();

        // Step 1: Calculate midnight IST for today
        const formattedDate = new Date(currentDate);
        formattedDate.setHours(0, 0, 0, 0); // Set to today's midnight in UTC

        // Step 2: Apply IST offset (UTC + 5:30)
        const IST_OFFSET = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
        const istMidnightToday = new Date(formattedDate.getTime() + IST_OFFSET); // Midnight IST for today

        // Step 3: Calculate midnight IST for the next day
        const nextDayMidnightIST = new Date(istMidnightToday);
        nextDayMidnightIST.setDate(istMidnightToday.getDate() + 1); // Move to the next day (2025-01-08T00:00:00 IST)

        // Step 4: Convert next day's midnight IST to UTC
        const nextDayMidnightUTC = new Date(nextDayMidnightIST.getTime() - IST_OFFSET); // Midnight UTC for the next day (2025-01-07T18:30:00 UTC)

        // Step 5: Update bookings that are past the current date and have 'Booked' status
        const bookingsToUpdate = await Booking.find({
            eventDate: { $lt: nextDayMidnightUTC }, // Only those before the next day's midnight IST in UTC
            status: 'Booked' // Only get bookings with status 'Booked'
        });

        for (const booking of bookingsToUpdate) {
            booking.status = 'Completed';
            await booking.save();
        }

        // Step 6: Delete events that occurred before the next day's midnight IST
        const eventsToDelete = await Event.find({
            eventDate: { $lt: nextDayMidnightUTC } // Only events before the next day's midnight IST (converted to UTC)
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
