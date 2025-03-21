const express = require("express");
let verifyToken = require('../interceptor/auth.interceptor');
let bookingdetailsInterceptor = require('../interceptor/bookingdetails.interceptor');
let feedbackController = require('../controllers/feedback.controller');
const router = express.Router();

router.get("/giveFeedback/:bookingId/:rating/:token", verifyToken,  bookingdetailsInterceptor.validateBookingId, feedbackController.giveFeedback);


module.exports = router;


