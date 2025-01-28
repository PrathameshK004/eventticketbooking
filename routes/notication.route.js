const express = require("express");
let notificationController = require('../controllers/notification.controller');
let notificationInterceptor = require('../interceptor/notification.interceptor');
let verifyToken = require('../interceptor/auth.interceptor');
const router = express.Router();

router.get("/getNotificationofUser/:userId", verifyToken, notificationInterceptor.validateUserId, notificationController.getNotifications);
router.get("/getNotificationofAdmin/:adminId", verifyToken, notificationInterceptor.validateAdmin, notificationController.getNotifications);

module.exports = router;
