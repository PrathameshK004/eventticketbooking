const Reward = require('../modules/reward.module'); 
const mongoose = require('mongoose');

module.exports = {
    validateRewardId
};

function isUuidValid(id) {
    return mongoose.Types.ObjectId.isValid(id);
}

async function validateRewardId(req, res, next) {
    const rewardId = req.params.rewardId;

    if (!isUuidValid(rewardId)) {
        return res.status(400).json({ error: 'Invalid Reward ID. Please provide a valid UUID.' });
    }
    
    const reward = await Reward.findById(rewardId);
    if (!reward || !rewardId ) {
        return res.status(400).json({ message: "Reward not found." });
    }

    next();
};
