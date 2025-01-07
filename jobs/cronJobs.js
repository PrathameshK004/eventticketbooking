const Booking = require('../modules/bookingdetails.module.js');
const Event = require('../modules/event.module.js');

// Schedule a task to run every hour 
cron.schedule('0 * * * *', async () => {

    try {
        const currentDate = new Date();
        const formattedDate=new Date(currentDate);
        formattedDate.setHours(0, 0, 0, 0);
        const IST_OFFSET = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
        const istMidnight = new Date(formattedDate.getTime() + IST_OFFSET);
        
        const bookingsToUpdate = await Booking.find({
            eventDate: { $lt: istMidnight },
            status: 'Booked' // Only get bookings with status 'Booked'
        });

       
        for (const booking of bookingsToUpdate) {
            booking.status = 'Completed';
            await booking.save();
        }

        
    } catch (err) {
        console.error('Error updating bookings:', err);
    }
});