const Coupon = require('../modules/coupon.module'); 
const Event = require('../modules/event.module'); 
const mongoose = require('mongoose');

module.exports = {
    validateCouponId,
    validateCouponCode,
    validateCouponDetails,
    validateUpdateCouponDetails
};

function isUuidValid(id) {
    return mongoose.Types.ObjectId.isValid(id);
}


async function validateCouponId(req, res, next) {
    const couponId = req.params.couponId;

    if (!isUuidValid(couponId)) {
        return res.status(400).json({ error: 'Invalid Coupon ID. Please provide a valid UUID.' });
    }
    
    const coupon = await Coupon.findById(couponId);
    if (!coupon || !couponId ) {
        return res.status(400).json({ message: "Coupon not found." });
    }

    next();
};

async function validateCouponCode(req, res, next) {
    const { code } = req.params;

    if (!code) {
        return res.status(400).json({ error: "Coupon code is required." });
    }

    const codeRegex = /^[A-Z0-9]+$/;
    if (!codeRegex.test(code.trim())) {
        return res.status(400).json({ 
            error: "Invalid coupon code format. Use only uppercase letters (A-Z) and numbers (0-9)." 
        });
    }

    next();
};


async function validateCouponDetails(req, res, next) {
    const { code, discountPercentage, noOfUses, expirationDate, status, eventId } = req.body;

    if (!code || discountPercentage == null || noOfUses == null || !expirationDate) {
        return res.status(400).json({ error: "Missing required fields." });
    }

    const codeRegex = /^[A-Z0-9]+$/;
    if (!codeRegex.test(code)) {
        return res.status(400).json({ error: "Coupon code must contain only uppercase letters and numbers." });
    }

    const existingCoupon = await Coupon.findOne({ code });
    if (existingCoupon) {
        return res.status(400).json({ error: "Coupon code already exists." });
    }

    if (typeof discountPercentage !== "number" || discountPercentage <= 0 || discountPercentage >= 90) {
        return res.status(400).json({ error: "Discount percentage must be a number between 1 and 90." });
    }

    if (typeof noOfUses !== "number" || noOfUses <= 0) {
        return res.status(400).json({ error: "Number of uses must be a non-negative number and zero." });
    }

    const currentDate = new Date();
    const parsedExpirationDate = new Date(expirationDate);
    if (isNaN(parsedExpirationDate.getTime()) || parsedExpirationDate <= currentDate) {
        return res.status(400).json({ error: "Expiration date must be a valid future date." });
    }

    const allowedStatuses = ["Active", "Inactive"];
    if (status && !allowedStatuses.includes(status)) {
        return res.status(400).json({ error: "Invalid status. Allowed values: 'Active' or 'Inactive'." });
    }

    const event = await Event.findById(eventId);
    if (!event) {
        return res.status(404).json({ error: "Event not found." });
    }

    next();
}


async function validateUpdateCouponDetails(req, res, next) {
    const { code, discountPercentage, noOfUses, expirationDate, status, eventId } = req.body;

    const codeRegex = /^[A-Z0-9]+$/;
    if (!codeRegex.test(code)) {
        return res.status(400).json({ error: "Coupon code must contain only uppercase letters and numbers." });
    }

    if (typeof discountPercentage !== "number" || discountPercentage <= 0 || discountPercentage >= 90) {
        return res.status(400).json({ error: "Discount percentage must be a number between 1 and 90." });
    }

    if (typeof noOfUses !== "number" || noOfUses <= 0) {
        return res.status(400).json({ error: "Number of uses must be a non-negative number and zero." });
    }

    const currentDate = new Date();
    const parsedExpirationDate = new Date(expirationDate);
    if (isNaN(parsedExpirationDate.getTime()) || parsedExpirationDate <= currentDate) {
        return res.status(400).json({ error: "Expiration date must be a valid future date." });
    }

    const allowedStatuses = ["Active", "Inactive"];
    if (status && !allowedStatuses.includes(status)) {
        return res.status(400).json({ error: "Invalid status. Allowed values: 'Active' or 'Inactive'." });
    }

    const event = await Event.findById(eventId);
    if (!event) {
        return res.status(404).json({ error: "Event not found." });
    }

    next();
}

