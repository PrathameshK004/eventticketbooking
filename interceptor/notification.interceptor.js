const User = require('../modules/user.module'); 
const Notification = require('../modules/notification.module'); 
const mongoose = require('mongoose');

module.exports = {
    validateUserId,
    validateNotificationId
};

function isUuidValid(id) {
    return mongoose.Types.ObjectId.isValid(id);
}

async function validateUserId(req, res, next) {
    const userId = req.params.userId;

    if (!isUuidValid(userId)) {
        return res.status(400).json({ error: 'Invalid User ID. Please provide a valid UUID.' });
    }
    
    const user = await User.findById(userId);
    if (!user || !userId || user.isTemp) {
        return res.status(400).json({ message: "User not found or is temporary." });
    }

    next();
};

async function validateNotificationId(req, res, next) {
    const notificationId = req.params.notificationId;

    if (!isUuidValid(notificationId)) {
        return res.status(400).json({ error: 'Invalid Notification ID. Please provide a valid UUID.' });
    }
    
    const noti = await Notification.findById(notificationId);
    if (!noti || !notificationId ) {
        return res.status(400).json({ message: "Notification not found." });
    }

    next();
};

