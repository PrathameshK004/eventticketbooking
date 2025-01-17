let express = require("express");
let router = express.Router();
let bookingdetailsController = require('../controllers/bookingdetails.controller');
let bookingdetailsInterceptor = require('../interceptor/bookingdetails.interceptor')

router.get('/allBookings', bookingdetailsController.getAllBookings);
router.get('/userBookings/:userId', bookingdetailsInterceptor.validateUserId, bookingdetailsController.getUserBookings);
router.get('/eventBookings/:eventId', bookingdetailsInterceptor.validateEventId, bookingdetailsController.getEventBookings);
router.get('/:bookingId', bookingdetailsInterceptor.validateBookingId, bookingdetailsController.getBookingById);
router.post('/addBookingDetails', bookingdetailsInterceptor.validateNewBooking, bookingdetailsController.createBooking);
router.post('/addBookingDetailsByWallet', bookingdetailsInterceptor.validateNewBooking, bookingdetailsController.createBookingWithWallet);
router.put('/:bookingId', bookingdetailsInterceptor.validateBookingId, bookingdetailsInterceptor.validateUpdateBooking, bookingdetailsController.updateBooking);
router.delete('/:bookingId', bookingdetailsInterceptor.validateBookingId, bookingdetailsController.deleteBooking);


module.exports = router;