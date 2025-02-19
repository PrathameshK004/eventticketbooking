const express = require("express");
const router = express.Router();
const reportController = require('../controllers/orgReport.controller');
const reportInterceptor = require('../interceptor/orgReport.interceptor');
let verifyToken = require('../interceptor/auth.interceptor');

router.get('/downloadReport/:eventId', verifyToken, reportInterceptor.validateEventId, reportController.downloadReport);
router.get('/sendReport/:eventId', verifyToken, reportInterceptor.validateEventId, reportController.sendReport);

module.exports = router;