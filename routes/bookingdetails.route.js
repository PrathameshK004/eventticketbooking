let express = require("express");
let router = express.Router();
let bookingdetailsController = require('../controllers/bookingdetails.controller');
let bookingdetailsInterceptor = require('../interceptor/bookingdetails.interceptor');
let verifyToken = require('../interceptor/auth.interceptor');

router.get('/allBookings', verifyToken, bookingdetailsController.getAllBookings);
router.get('/userBookings/:userId', verifyToken, bookingdetailsInterceptor.validateUserId, bookingdetailsController.getUserBookings);
router.get('/eventBookings/:eventId', verifyToken, bookingdetailsInterceptor.validateEventId, bookingdetailsController.getEventBookings);
router.get('/:bookingId', verifyToken, bookingdetailsInterceptor.validateBookingId, bookingdetailsController.getBookingById);
router.post('/addBookingDetails', verifyToken, bookingdetailsInterceptor.validateNewBooking, bookingdetailsController.createBooking);
router.post('/addBookingDetailsByWallet', verifyToken, bookingdetailsInterceptor.validateNewBooking, bookingdetailsController.createBookingWithWallet);
router.put('/:bookingId', verifyToken, bookingdetailsInterceptor.validateBookingId, bookingdetailsInterceptor.validateUpdateBooking, bookingdetailsController.updateBooking);
router.delete('/:bookingId', verifyToken, bookingdetailsInterceptor.validateBookingId, bookingdetailsController.deleteBooking);


module.exports = router;