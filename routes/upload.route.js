const express = require('express');
const router = express.Router();
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

// Multer middleware with file filter for images and videos
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

// Upload route
router.post('/', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

    // Create an upload stream in GridFS for the uploaded file
    const uploadStream = bucket.openUploadStream(req.file.originalname, {
      contentType: req.file.mimetype,
    });

    // Write the buffer directly to GridFS
    uploadStream.end(req.file.buffer);

    // Handle upload success and error
    uploadStream.on('finish', (file) => {
      console.log('File uploaded successfully');
      return res.status(200).json({ message: 'File uploaded successfully', file });
    });

    uploadStream.on('error', (err) => {
      console.error('Upload error:', err);
      return res.status(500).json({ error: 'Failed to upload file.' });
    });
  });

  module.exports = router;

 