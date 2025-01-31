const jwt = require('jsonwebtoken');
const AdminNotification = require('../modules/adminNotification.module'); 
const mongoose = require('mongoose');
const User = require('../modules/user.module.js');

module.exports = {
    validateAdmin,
    validateNotificationId,
    validateNotificationResponse
};

function isUuidValid(id) {
    return mongoose.Types.ObjectId.isValid(id);
}

async function validateAdmin(req, res, next) {

    const token = req.cookies.jwt;

    if (!token) {
        return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWTSecret);
    const userId = decoded.key;

    if (!isUuidValid(userId)) {
        return res.status(400).json({ error: 'Invalid User ID. Please provide a valid UUID.' });
    }

    const userDetail = await User.findById( userId );
    if(!userDetail || !userDetail.isTemp){
        return res.status(404).json({ message: "User not found" });
    }

    if (!userDetail.roles.includes(2)) {
        return res.status(403).json({ message: 'Access Denied!!. You are not an Admin.' });
    }
    
    next();
};

async function validateNotificationId(req, res, next) {
    const notificationId = req.params.notificationId;

    if (!isUuidValid(notificationId)) {
        return res.status(400).json({ error: 'Invalid Notification ID. Please provide a valid UUID.' });
    }
    
    const noti = await AdminNotification.findById(notificationId);
    if (!noti || !notificationId ) {
        return res.status(400).json({ message: "Notification not found." });
    }

    next();
};

async function validateNotificationResponse(req, res, next) {
    const { notificationId } = req.params;
    const { status, remarks } = req.body;

    if (!isUuidValid(notificationId)) {
        return res.status(400).json({ error: 'Invalid notification ID. Please provide a valid UUID.' });
    }

    if (!status || !['Pending', 'Accepted', 'Rejected'].includes(status)) {
        return res.status(400).json({ error: 'Status is required and must be either Pending, Accepted, or Rejected.' });
    }

    if (!remarks) {
        return res.status(400).json({ error: 'Remarks is required.' });
    }

    try {
        const existingNoti= await AdminNotification.findById(notificationId);
        if (!existingNoti) {
            return res.status(404).json({ error: 'Notification not found.' });
        }
        next();
    } catch (error) {
        res.status(500).json({ error: 'An error occurred while validating the notification. ' + error });
    }
}
