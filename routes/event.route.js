const express = require("express");
const multer = require("multer");
const router = express.Router();
const eventController = require('../controllers/event.controller');
const eventInterceptor = require('../interceptor/event.interceptor');

// Multer middleware for file uploads
const upload = multer({
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB file size limit
  },
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
  upload.single('file'), // Include multer middleware first
  (req, res, next) => {
    // Handle file upload errors
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    next();
  },
  eventInterceptor.validateNewEvent,
  eventController.createEvent
);
router.put('/:eventId', eventInterceptor.validateUpdateEvent, eventController.updateEvent);
router.delete('/:eventId', eventInterceptor.validateEventId, eventController.deleteEvent);

module.exports = router;

