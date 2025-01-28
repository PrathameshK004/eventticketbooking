const User = require('../module/user.module'); 

module.exports = {
    validateUserId,
    validateAdmin
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


async function validateAdmin(req, res, next) {
    const adminId = req.params.adminId;

    if (!isUuidValid(adminId)) {
        return res.status(400).json({ error: 'Invalid User ID. Please provide a valid UUID.' });
    }
    
    const user = await User.findById(adminId); 

    if (!user || !adminId || user.isTemp) {
        return res.status(400).json({ message: "User not found or is temporary." });
    }

    if (!user.roles.includes(2)) { 
        return res.status(400).json({ message: "You are not an Admin." });
    }

    next();
};
