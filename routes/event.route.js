const express = require("express");
const multer = require("multer");
const router = express.Router();
const eventController = require('../controllers/event.controller');
const eventInterceptor = require('../interceptor/event.interceptor');
const path = require('path');

// Multer middleware for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB file size limit
  },
  fileFilter: (req, file, cb) => {
    const fileTypes = /jpeg|jpg|png|gif|mp4|mkv|avi|mov|wmv/;
    const extname = path.extname(file.originalname).toLowerCase();
    const mimetype = file.mimetype;

    if (fileTypes.test(extname) && fileTypes.test(mimetype)) {
      return cb(null, true);
    } else {
      return cb(new Error('Error: File type not allowed!'));
    }
  },
});

// Define routes
router.get('/allEvents', eventController.getAllEvents);
router.get('/:eventId', eventInterceptor.validateEventId, eventController.getEventById);
router.post(
  '/addEvent',
  upload.single('file'),
  eventInterceptor.validateNewEvent,
  eventController.createEvent
);
router.put('/:eventId', eventInterceptor.validateUpdateEvent, eventController.updateEvent);
router.delete('/:eventId', eventInterceptor.validateEventId, eventController.deleteEvent);

module.exports = router;
