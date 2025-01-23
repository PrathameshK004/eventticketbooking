const express = require('express');
const router = express.Router();
const multer = require('multer');
const mongoose = require('mongoose');
const { GridFSBucket } = require('mongodb');
require('dotenv').config();

// MongoDB Connection
const mongoURI = process.env.CONNECTIONSTRING;
const conn = mongoose.createConnection(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Initialize GridFSBucket
let bucket;

conn.once('open', () => {
  bucket = new GridFSBucket(conn.db, { bucketName: 'uploads' });
  console.log('GridFS initialized');
});

// Multer middleware for file upload (Images & Videos allowed)
const upload = multer({
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/jpg',  // Images
      'video/mp4', 'video/mov', 'video/avi', 'video/mkv' // Videos
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Error: Only images (JPG, PNG) and videos (MP4, MOV, AVI, MKV) are allowed!'), false);
    }
  },
});

// Upload Route
router.post('/', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    // Ensure GridFS is initialized
    if (!bucket) {
      return res.status(500).json({ error: 'GridFS is not initialized yet' });
    }

    // Keep original filename
    const originalFilename = req.file.originalname;

    // Create an upload stream with the original filename
    const uploadStream = bucket.openUploadStream(originalFilename, {
      contentType: req.file.mimetype,
    });

    // Write the file buffer to GridFS
    uploadStream.end(req.file.buffer);

    uploadStream.on('finish', async () => {
      console.log('File uploaded successfully:', originalFilename);

      // Retrieve file metadata from GridFS
      const db = conn.db;
      const filesCollection = db.collection('uploads.files');
      const uploadedFile = await filesCollection.findOne({ filename: originalFilename });

      if (!uploadedFile) {
        return res.status(404).json({ error: 'File not found after upload.' });
      }

      const fileMetadata = {
        _id: uploadedFile._id,
        filename: uploadedFile.filename,
        contentType: uploadedFile.contentType,
        length: uploadedFile.length,
        uploadDate: uploadedFile.uploadDate,
      };

      return res.status(200).json({
        message: 'File uploaded successfully',
        file: fileMetadata,
      });
    });

    uploadStream.on('error', (err) => {
      console.error('Upload error:', err);
      return res.status(500).json({ error: 'Failed to upload file.' });
    });

  } catch (error) {
    console.error('Upload failed:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
