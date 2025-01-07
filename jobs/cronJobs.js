const cron = require('node-cron');
const Booking = require('../modules/bookingdetails.module.js');
const Event = require('../modules/event.module.js');

// Schedule a task to run every minute
cron.schedule('* * * * *', async () => {
    try {
        const currentDate = new Date();
        
        // Get midnight of today in UTC (as base time)
        const formattedDate = new Date(currentDate);
        formattedDate.setHours(0, 0, 0, 0); // Set to today's midnight (00:00:00)
        
        // Apply IST offset (UTC + 5:30)
        const IST_OFFSET = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
        const istMidnight = new Date(formattedDate.getTime() + IST_OFFSET); // Today's midnight in IST

        // Step 1: Update bookings that are past the current date and have 'Booked' status
        const bookingsToUpdate = await Booking.find({
            eventDate: { $lt: istMidnight }, // Only those before today's midnight (00:00:00 IST)
            status: 'Booked' // Only get bookings with status 'Booked'
        });

        for (const booking of bookingsToUpdate) {
            booking.status = 'Completed';
            await booking.save();
        }

        // Step 2: Delete events that are before today's midnight (00:00:00 IST)
        const eventsToDelete = await Event.find({
            eventDate: { $lt: istMidnight } // Only events that occurred before today's midnight (00:00:00 IST)
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
