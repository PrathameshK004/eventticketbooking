const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../modules/user.module.js');
const Event = require('../modules/event.module.js');

module.exports = {
    validateEventId
};

function isUuidValid(id) {
    return mongoose.Types.ObjectId.isValid(id);
}

async function validateEventId(req, res, next) {
    const eventId = req.params.eventId;

    if (!isUuidValid(eventId)) {
        return res.status(400).json({ error: 'Invalid Event ID. Please provide a valid UUID.' });
    }
    
    const event = await Event.findById(eventId);
    if (!event || !eventId ) {
        return res.status(400).json({ message: "Event not found." });
    }

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
    if(!userDetail || userDetail.isTemp){
        return res.status(404).json({ message: "User not found" });
    }

    if (!userDetail.eventId.includes(eventId)) {
        return res.status(403).json({ message: "You are not the Organizer of this Event" });
    }
    
    if (event.userId !== userDetail._id.toString()) {
        return res.status(403).json({ message: "You are not the Organizer of this Event" });
    }
    

    next();
};
