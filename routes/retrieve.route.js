const express = require('express');
const router = express.Router();
const multer = require('multer');
const mongoose = require('mongoose');
const { GridFSBucket } = require('mongodb');
require('dotenv').config();

// MongoDB URI
const mongoURI = process.env.CONNECTIONSTRING;
const conn = mongoose.createConnection(mongoURI, {});

let bucket;

conn.once('open', () => {
  bucket = new GridFSBucket(conn.db, { bucketName: 'uploads' });
});

router.get('/:filename', (req, res) => {
    const fileName = req.params.filename;
  
    // Find the file in GridFS using the filename
    bucket.find({ filename: fileName }).toArray((err, files) => {
      if (!files || files.length === 0) {
        return res.status(404).json({ error: 'File not found' });
      }
  
      // Create a download stream
      const downloadStream = bucket.openDownloadStreamByName(fileName);
  
      // Set headers for image response
      res.set('Content-Type', files[0].contentType);
      res.set('Content-Disposition', `inline; filename="${fileName}"`);
  
      // Pipe the image stream to the response
      downloadStream.pipe(res);
  
      // Handle errors during streaming
      downloadStream.on('error', (err) => {
        console.error('Download error:', err);
        res.status(500).json({ error: 'Error retrieving file.' });
      });
    });
  });
  
  
  
  
  // Export the router
  module.exports = router;
  