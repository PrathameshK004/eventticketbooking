const express = require("express");
const userRoutes = require("./user.route");
const eventRoutes = require("./event.route");
const bookingDetailsRoutes = require("./bookingdetails.route");
const walletRoutes = require("./wallet.route");
const notificationRoutes = require("./notification.route");
const adminNotificationRoutes = require("./adminNotification.route");
const enquiryRoutes = require("./enquiry.route");
const router = express.Router();


router.use('/users',userRoutes);
router.use('/adminNotifications',adminNotificationRoutes);
router.use('/notifications',notificationRoutes);
router.use('/events',eventRoutes);
router.use('/bookingdetails',bookingDetailsRoutes);
router.use('/wallet',walletRoutes);
router.use('/enquiry',enquiryRoutes);

module.exports=router;