const cron = require('node-cron');
const Booking = require('../modules/bookingdetails.module.js');
const Event = require('../modules/event.module.js');

// Schedule a task to run every hour 
cron.schedule('*/10 * * * * *', async () => {
    try {

        const currentDate = new Date();
        const formattedDate=new Date(currentDate.toISOString().split('T')[0]);
        const bookingsToUpdate = await Booking.find({
            eventDate: { $lt: formattedDate },
            status: 'Booked' // Only get bookings with status 'Booked'
        });

        // Update the status of each booking
        for (const booking of bookingsToUpdate) {
            booking.status = 'Completed';
            await booking.save();
        }

    } catch (err) {
        console.error('Error updating bookings:', err);
    }
});
