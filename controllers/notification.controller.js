const Notification = require('../modules/notification.module.js');

module.exports = {
    getNotifications,
    sendNotification
};

async function sendNotification(type, title, message, userId){
    try {
        const notification = new Notification({ type, title, message, userId });
        await notification.save();
        console.log("Notification saved successfully:", notification);
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

