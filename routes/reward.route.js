const express = require("express");
let rewardInterceptor = require('../interceptor/reward.interceptor');
let rewardController = require('../controllers/reward.controller');
let userInterceptor = require('../interceptor/user.interceptor');
let verifyToken = require('../interceptor/auth.interceptor');
const router = express.Router();

router.get("/getRewards/:userId", verifyToken, userInterceptor.validateUserId, rewardController.getAllUserRewards);
router.get("/redeemReward/:rewardId", verifyToken, rewardInterceptor.validateRewardId, rewardController.redeemReward );
router.get("/redeemAllRewards/:userId", verifyToken, userInterceptor.validateUserId, rewardController.redeemAllRewards);
router.get("/getRewardCount/:userId", verifyToken, userInterceptor.validateUserId, rewardController.getRewardsCount );
router.patch("/updateReward/:rewardId", verifyToken, rewardInterceptor.validateRewardId, rewardController.updateReward );

module.exports = router;


