const express = require("express");
const multer = require("multer");
const router = express.Router();
const eventController = require('../controllers/event.controller');
const eventInterceptor = require('../interceptor/event.interceptor');

// Multer middleware for file uploads
const upload = multer({
  fileFilter: (req, file, cb) => {
    const fileTypes = /jpeg|jpg|png|gif|mp4|mkv|avi|mov|wmv/;
    const extname = fileTypes.test(file.mimetype);
    const mimetype = fileTypes.test(file.originalname.split('.').pop().toLowerCase());

    if (extname && mimetype) {
      return cb(null, true);
    } else {
      return cb(new Error('Error: File type not allowed!'));
    }
  },
});

// Define routes
router.get('/searchEvents', eventController.searchEventsByKeyword);
router.get('/allEvents', eventController.getAllEvents);
router.get('/:eventId', eventInterceptor.validateEventId, eventController.getEventById);
router.post(
  '/addEvent',
  upload.single('file'), // Include multer middleware
  eventInterceptor.validateNewEvent,
  eventController.createEvent
);
router.put('/:eventId', eventInterceptor.validateUpdateEvent, eventController.updateEvent);
router.delete('/:eventId', eventInterceptor.validateEventId, eventController.deleteEvent);

module.exports = router;
