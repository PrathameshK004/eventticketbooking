const express = require('express');
const router = express.Router();
const eventController = require('../controllers/event.controller');
const eventInterceptor = require('../interceptor/event.interceptor');
const multer = require('multer');
const mongoose = require('mongoose');
const { GridFSBucket } = require('mongodb');
require('dotenv').config();

// MongoDB URI
const mongoURI = process.env.CONNECTIONSTRING;
const conn = mongoose.createConnection(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Initialize GridFSBucket
let bucket;

conn.once('open', () => {
  bucket = new GridFSBucket(conn.db, { bucketName: 'uploads' });
});

// Set up multer for file handling
const upload = multer({
  fileFilter: (req, file, cb) => {
    const fileTypes = /jpeg|jpg|png|gif|mp4|mkv|avi|mov|wmv/; // Define accepted file types
    const extname = fileTypes.test(file.mimetype); // Check MIME type
    const mimetype = fileTypes.test(file.originalname.split('.').pop().toLowerCase()); // Check extension

    if (extname && mimetype) {
      return cb(null, true); // Accept the file
    } else {
      cb(new Error('Error: File type not allowed!')); // Reject the file
    }
  },
});

// Define routes
router.get('/searchEvents', eventController.searchEventsByKeyword);
router.get('/allEvents', eventController.getAllEvents);
router.get('/:eventId', eventInterceptor.validateEventId, eventController.getEventById);

// POST route for adding an event with file upload
router.post('/addEvent', eventInterceptor.validateNewEvent, upload.single('file'), (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  // Create an upload stream in GridFS for the uploaded file
  const uploadStream = bucket.openUploadStream(req.file.originalname, {
    contentType: req.file.mimetype,
  });

  // Write the file buffer directly to GridFS
  uploadStream.end(req.file.buffer);

  // Handle upload success and error
  uploadStream.on('finish', (file) => {
    console.log('File uploaded successfully');
    
    // Rename the uploaded file using its MongoDB _id
    const newFilename = file._id.toString(); // Use MongoDB _id as the filename
    
    // Create a GridFS file update stream to rename the file
    const updateStream = bucket.openDownloadStream(file._id);
    const fileWriteStream = bucket.openUploadStream(newFilename, {
      contentType: req.file.mimetype,
    });
    
    updateStream.pipe(fileWriteStream);
    
    // Once renaming is complete, handle success
    fileWriteStream.on('finish', () => {
      console.log(`File renamed to: ${newFilename}`);
      req.fileId = file._id; // Attach the file ID to the request object for further processing
      next();
    });

    updateStream.on('error', (err) => {
      console.error('Error during file renaming:', err);
      return res.status(500).json({ error: 'Failed to rename the file.' });
    });
  });

  uploadStream.on('error', (err) => {
    console.error('Upload error:', err);
    return res.status(500).json({ error: 'Failed to upload file.' });
  });
}, eventController.createEvent); // The createEvent function will be called after the file is uploaded and renamed

router.put('/:eventId', eventInterceptor.validateUpdateEvent, eventController.updateEvent);
router.delete('/:eventId', eventInterceptor.validateEventId, eventController.deleteEvent);

module.exports = router;
