const User = require('../modules/user.module'); 
const mongoose = require('mongoose');

module.exports = {
    validateUserId
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

