const cron = require('node-cron');
const Booking = require('../modules/bookingdetails.module.js');
const Event = require('../modules/event.module.js');

// Schedule a task to run every minute
cron.schedule('* * * * *', async () => {
    try {
        const currentDate = new Date();
        const IST_OFFSET = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
        const currentDateIST = new Date(currentDate.getTime() + IST_OFFSET); // Current time in IST
        
        // Step 1: Update bookings that are past the current date and have 'Booked' status
        const bookingsToUpdate = await Booking.find({
            eventDate: { $lt: currentDateIST }, // Compare with current time in IST
            status: 'Booked' // Only get bookings with status 'Booked'
        });

        for (const booking of bookingsToUpdate) {
            booking.status = 'Completed';
            await booking.save();
        }

        // Step 2: Delete events that are past the current date (before the current time in IST)
        const eventsToDelete = await Event.find({
            eventDate: { $lt: currentDateIST } // Compare with current time in IST
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
