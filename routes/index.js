const express = require("express");
const userRoutes = require("./user.route");
const eventRoutes = require("./event.route");
const bookingDetailsRoutes = require("./bookingdetails.route");
const walletRoutes = require("./wallet.route");
const router = express.Router();


router.use('/users',userRoutes);
router.use('/events',eventRoutes);
router.use('/bookingdetails',bookingDetailsRoutes);
router.use('/wallet',walletRoutes);

module.exports=router;