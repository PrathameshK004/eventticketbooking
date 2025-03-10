const AdminNotification = require('../modules/adminNotification.module.js');
const User = require('../modules/user.module.js');
const Event = require('../modules/event.module.js');
let notificationController = require('./notification.controller');
const { GridFSBucket } = require('mongodb');
const ObjectId = require('mongoose').Types.ObjectId;
const mongoose = require('mongoose');

// Initialize GridFSBucket
let bucket;

const conn = mongoose.connection;
conn.once('open', () => {
    bucket = new GridFSBucket(conn.db, { bucketName: 'uploads' });
});

module.exports = {
    getAdminNotificationsCount,
    getAllAdminNotifications,
    deleteAdminNotification,
    updateAdminNotification
};

async function getAllAdminNotifications(req, res) {
    try {

        const notifications = await AdminNotification.find({ status: "Pending"});

        if (!notifications || notifications.length === 0) {
            return res.status(404).json({ message: "No notifications found." });
        }

        res.status(200).json(notifications);
    } catch (error) {
        console.error("Error fetching notifications:", error.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
}


async function getAdminNotificationsCount(req, res) {
    try {

        const notificationCount = await AdminNotification.countDocuments({ status: "Pending" });

        res.status(200).json({ totalNotifications: notificationCount });
    } catch (error) {
        console.error("Error fetching notifications count:", error.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

async function deleteAdminNotification(req, res) {
    try {
        const notificationId = req.params.notificationId;

        if (!notificationId) {
            return res.status(400).json({ message: "Notification ID is required" });
        }

        const deletedNotification = await AdminNotification.findByIdAndDelete(notificationId);

        if (!deletedNotification) {
            return res.status(404).json({ message: "Notification not found" });
        }

        res.status(200).json({ message: "Notification deleted successfully" });

    } catch (error) {
        console.error("Error deleting notification:", error.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

async function updateAdminNotification(req, res) {
    try {
        const { status, remarks } = req.body;
        const noti = await AdminNotification.findById(req.params.notificationId);
        if (!noti) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        if (noti.status !== 'Pending') {
            return res.status(400).json({ error: 'Only pending notification can be updated' });
        }

        if (status === "Accepted") {
            try {
                const event = await Event.findById(noti.eventDetails);
                if (!event) {
                    return res.status(404).json({ message: 'Event not found' });
                }

                if (!event.isTemp) {
                    return res.status(404).json({ message: 'Event is already Permanent' });
                }

                const user = await User.findById(event.userId);
                
                if (!user) {
                    return res.status(404).json({ message: 'User not found' });
                }
                await notificationController.sendNotification("event", `${event.eventTitle} is Accepted`, `Your event ${event.eventTitle} is live.`, event.userId)
                event.isTemp=false;
                event.isLive=true;
                event.approveDate = Date.now();
                await event.save();
            }
            catch (err) {
                console.error("Failed to create notification:", err);
            }

        }

        if (status === "Rejected") {
            try{
                const event = await Event.findById(noti.eventDetails);
                if (!event) {
                    return res.status(404).json({ message: 'Event not found' });
                }

                if (!event.isTemp) {
                    return res.status(404).json({ message: 'Event is already Permanent' });
                }

                const user = await User.findById(event.userId);
                
                if (!user) {
                    return res.status(404).json({ message: 'User not found' });
                }
                await notificationController.sendNotification("event", `${event.eventTitle} is Rejected`, `Your event ${event.eventTitle} is Declined.`, event.userId)
                const eventDel = await Event.findByIdAndDelete(noti.eventDetails);
                await User.updateOne(
                    { _id: user._id },  // Match the specific user by userId
                    { $pull: { eventId: eventDel._id } } // Remove the eventId from the array
                );
                
                if (eventDel.fileId) {
                    await bucket.delete(new ObjectId(eventDel.fileId));
                }
            }
            catch (err) {
                console.error("Failed to update notification:", err);
            }


        }

        noti.status = status;
        noti.remarks = remarks;
        await noti.save();
        res.status(200).json({ message: 'Response updated' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update notification' });
    }
};