const express = require("express");
const userRoutes = require("./user.route");
const eventRoutes = require("./event.route");
const bookingDetailsRoutes = require("./bookingdetails.route");
const router = express.Router();


router.use('/users',userRoutes);
router.use('/events',eventRoutes);
router.use('/bookingdetails',bookingDetailsRoutes);

module.exports=router;