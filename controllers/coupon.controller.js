const Coupon = require('../modules/coupon.module.js');
const mongoose = require('mongoose');

module.exports = {
    getAllCoupons,
    checkCoupon,
    createCoupon,
    updateCoupon,
    deleteCoupon
};

async function getAllCoupons(req, res) {
    try {
        const coupons = await Coupon.find();
        res.status(200).json(coupons);
    } catch (error) {
        res.status(500).json({ error: "Error fetching coupons", details: error.message });
    }
}

async function checkCoupon(req, res) {
    try {
        const { couponId } = req.params;
        const { eventId } = req.params;

        const coupon = await Coupon.findById(couponId);
        if (!coupon) {
            return res.status(404).json({ error: "Coupon not found." });
        }

        if (coupon.eventId !== eventId) {
            return res.status(400).json({ error: "Coupon is not valid for this event." });
        }
        
        if (coupon.status !== "Active") {
            return res.status(400).json({ error: "Coupon is inactive and cannot be applied." });
        }

        const currentDate = new Date();
        if (coupon.expirationDate < currentDate) {
            return res.status(400).json({ error: "Coupon has expired." });
        }

        if (coupon.noOfUses <= 0) {
            return res.status(400).json({ error: "Coupon usage limit has been reached." });
        }

        res.status(200).json({ message: "Coupon is valid.", coupon });

    } catch (error) {
        res.status(500).json({ error: "Error retrieving coupon", details: error.message });
    }
}


async function createCoupon(req, res) {
    try {
        const { code, discountPercentage, noOfUses, expirationDate, status, eventId } = req.body;

        const parsedExpirationDate = new Date(expirationDate);
        const newCoupon = new Coupon({
            code,
            discountPercentage,
            noOfUses,
            expirationDate: parsedExpirationDate,
            status: status || "Active",
            eventId
        });

        await newCoupon.save();
        res.status(201).json({ message: "Coupon created successfully." });
    } catch (error) {
        res.status(500).json({ error: "Error creating coupon", details: error.message });
    }
}

async function updateCoupon(req, res) {
    try {
        const { couponId } = req.params;
        const updates = req.body;

        if (updates.expirationDate) {
            const parsedExpirationDate = new Date(updates.expirationDate);
            if (isNaN(parsedExpirationDate.getTime())) {
                return res.status(400).json({ error: "Invalid expiration date format." });
            }
            updates.expirationDate = parsedExpirationDate;
        }

        const updatedCoupon = await Coupon.findByIdAndUpdate(couponId, updates, { new: true });

        res.status(200).json({ message: "Coupon updated successfully.", coupon: updatedCoupon });
    } catch (error) {
        res.status(500).json({ error: "Error updating coupon", details: error.message });
    }
}


async function deleteCoupon(req, res) {
    try {
        const { couponId } = req.params;

        const coupon = await Coupon.findById(couponId);
        if (!coupon) {
            return res.status(404).json({ error: "Coupon not found." });
        }

        await Coupon.findByIdAndDelete(couponId);
        res.status(200).json({ message: "Coupon deleted successfully." });
    } catch (error) {
        res.status(500).json({ error: "Error deleting coupon", details: error.message });
    }
}

