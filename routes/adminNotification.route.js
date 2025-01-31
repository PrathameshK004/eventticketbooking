const express = require("express");
let adminNotificationController = require('../controllers/adminNotification.controller');
let adminNotificationInterceptor = require('../interceptor/adminNotification.interceptor');
let verifyToken = require('../interceptor/auth.interceptor');
const router = express.Router();

router.get("/getAllAdminNotifications", verifyToken, adminNotificationInterceptor.validateAdmin, adminNotificationController.getAllAdminNotifications);
router.get("/getAdminNotificationsCount", verifyToken, adminNotificationInterceptor.validateAdmin, adminNotificationController.getAdminNotificationsCount);
router.put("/respondAdminNotification/:notificationId", verifyToken, adminNotificationInterceptor.validateAdmin, adminNotificationInterceptor.validateNotificationId, adminNotificationInterceptor.validateNotificationResponse, adminNotificationController.updateAdminNotification);
router.delete("/deleteAdminNotification/:notificationId", verifyToken, adminNotificationInterceptor.validateAdmin, adminNotificationInterceptor.validateNotificationId, adminNotificationController.deleteAdminNotification);

module.exports = router;


