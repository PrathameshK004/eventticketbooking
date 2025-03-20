const express = require("express");
let verifyToken = require('../interceptor/auth.interceptor');
const router = express.Router();

router.get("/checkPendingFeedbacks/:userId", verifyToken, );
router.post("/giveFeedback/:feedbackId", verifyToken,  );
router.put("/updateFeedback/:feedbackId", verifyToken, );

module.exports = router;


