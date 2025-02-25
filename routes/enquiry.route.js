const express = require('express');
const router = express.Router();
const enquiryController = require('../controllers/enquiry.controller');
const enquiryInterceptor = require('../interceptor/enquiry.interceptor');
let verifyToken = require('../interceptor/auth.interceptor');
const path = require('path');
const multer = require("multer");


// Multer middleware for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB file size limit
  },
  fileFilter: (req, file, cb) => {
    const fileTypes = /jpeg|jpg|png/;
    const extname = path.extname(file.originalname).toLowerCase();
    const mimetype = file.mimetype;

    if (fileTypes.test(extname) && fileTypes.test(mimetype)) {
      return cb(null, true);
    } else {
      return cb(new Error('Error: File type not allowed!'));
    }
  },
});


router.post('/sendEnquiry', verifyToken, enquiryInterceptor.validateNewEnquiry, enquiryInterceptor.validateUserId, enquiryController.sendEnquiry);
router.post('/sendAddOrgEnquiry', verifyToken, upload.single('file'), enquiryInterceptor.validateNewOrgEnquiry, enquiryInterceptor.validateUserId, enquiryController.sendOrgEnquiry);
router.get('/allEnquiries/:adminId', verifyToken, enquiryInterceptor.validateAdminAndEnquiry, enquiryController.getAllEnquiries);
router.get('/getEnquiryByUserId/:userId', verifyToken, enquiryInterceptor.validateUserId, enquiryController.getEnquiryByUserId);
router.put('/respondEnquiry/:enquiryId/:adminId', verifyToken, enquiryInterceptor.validateEnquiryId, enquiryInterceptor.validateAdminAndEnquiry, enquiryInterceptor.validateEnquiryResponse, enquiryController.respondToEnquiry);
router.delete('/deleteEnquiry/:enquiryId', verifyToken, enquiryInterceptor.validateEnquiryId, enquiryController.deleteEnquiry);

module.exports = router;
