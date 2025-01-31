const Notification = require('../modules/notification.module.js');

module.exports = {
    getNotifications,
    getNotificationsCount,
    sendNotification,
    deleteNotification
};

async function sendNotification(type, title, message, userId){
    try {
        const notification = await Notification.create({ type, title, message, userId });
        return notification;
    } catch (error) {
        console.error("Error creating notification:", error.message);
        throw error;
    }
};


async function getNotifications(req, res){
    try {
        const userId = req.params.userId;
        
        let notifications;
        if (userId) {
            notifications = await Notification.find({ userId }).sort({ createdAt: -1 });
        }
        
        if (!notifications || !notifications.length) {
            return res.status(404).json({ message: "No notifications found." });
        }

        res.status(200).json(notifications);
    } catch (error) {
        console.error("Error fetching notifications:", error.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

async function getNotificationsCount(req, res) {
    try {
        const userId = req.params.userId;
        
        if (!userId) {
            return res.status(400).json({ message: "User ID is required." });
        }
        
        const notificationCount = await Notification.countDocuments({ userId });

        if (notificationCount === 0) {
            return res.status(404).json({ message: "No notifications found." });
        }

        res.status(200).json({ totalNotifications: notificationCount });
    } catch (error) {
        console.error("Error fetching notifications count:", error.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
};


async function deleteNotification(req, res) {
    try {
        const notificationId = req.params.notificationId;

        if (!notificationId) {
            return res.status(400).json({ message: "Notification ID is required" });
        }

        const deletedNotification = await Notification.findByIdAndDelete(notificationId);

        if (!deletedNotification) {
            return res.status(404).json({ message: "Notification not found" });
        }

        res.status(200).json({ message: "Notification deleted successfully" });

    } catch (error) {
        console.error("Error deleting notification:", error.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
};
