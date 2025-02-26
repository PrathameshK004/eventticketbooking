const express = require("express");
let adminNotificationInterceptor = require('../interceptor/adminNotification.interceptor');
let couponInterceptor = require('../interceptor/coupon.interceptor');
const eventInterceptor = require('../interceptor/event.interceptor');
let couponController = require('../controllers/coupon.controller');
let verifyToken = require('../interceptor/auth.interceptor');
const router = express.Router();

router.get("/getAllCoupons", verifyToken, adminNotificationInterceptor.validateAdmin, couponController.getAllCoupons);
router.get("/checkCoupon/:eventId/:couponId", verifyToken, eventInterceptor.validateEventId, couponInterceptor.validateCouponId, couponController.checkCoupon );
router.post("/addCoupon", verifyToken, adminNotificationInterceptor.validateAdmin,  couponInterceptor.validateCouponDetails, couponController.createCoupon);
router.put("/updateCoupon/:couponId", verifyToken, adminNotificationInterceptor.validateAdmin, couponInterceptor.validateCouponId,  couponInterceptor.validateCouponDetails, couponController.updateCoupon);
router.delete("/deleteCoupon/:couponId", verifyToken, adminNotificationInterceptor.validateAdmin, couponInterceptor.validateCouponId, couponController.deleteCoupon);

module.exports = router;


