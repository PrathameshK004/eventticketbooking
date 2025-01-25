const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { GridFSBucket } = require('mongodb');
const crypto = require('crypto');
const verifyToken = require('../interceptor/auth.interceptor'); // Assuming it extracts user info from JWT
require('dotenv').config();

// MongoDB Connection
const mongoURI = process.env.CONNECTIONSTRING;
const encryptionKey = process.env.ENCRYPTION_KEY; // 32-byte key for AES-256 encryption
const conn = mongoose.createConnection(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

let bucket;

conn.once('open', () => {
  bucket = new GridFSBucket(conn.db, { bucketName: 'enquiryUploads' });
});

// Middleware to check if user is an admin
function isAdmin(req, res, next) {
  if (!req.user || !req.user.roles || !req.user.roles.includes(2)) {
    return res.status(403).json({ error: 'Access denied. Admins only.' });
  }
  next();
}

// Function to decrypt file data
function decryptData(buffer) {
  const iv = buffer.slice(0, 16); // Extract IV from the start
  const encryptedData = buffer.slice(16); // The actual encrypted data
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(encryptionKey, 'hex'), iv);
  
  let decrypted = decipher.update(encryptedData);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  
  return decrypted;
}

// Route to retrieve encrypted file, decrypt it, and send to admin
router.get('/:fileName', verifyToken, isAdmin, async (req, res) => {
  if (!bucket) {
    return res.status(500).json({ error: 'Database connection not established yet.' });
  }

  try {
    const fileName = req.params.fileName;

    // Find the file in GridFS using the filename
    const files = await bucket.find({ filename: fileName }).toArray();

    if (!files || files.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const file = files[0]; // The first file in the array (there should only be one file with that name)

    // Create a download stream
    const downloadStream = bucket.openDownloadStreamByName(fileName);

    // Set response headers
    res.set('Content-Type', file.contentType);
    res.set('Content-Disposition', `inline; filename="${fileName}"`);

    const chunks = [];

    downloadStream.on('data', (chunk) => chunks.push(chunk));
    downloadStream.on('end', () => {
      try {
        const encryptedBuffer = Buffer.concat(chunks);
        const decryptedBuffer = decryptData(encryptedBuffer);
        res.send(decryptedBuffer);
      } catch (decryptErr) {
        console.error('Decryption error:', decryptErr);
        res.status(500).json({ error: 'Failed to decrypt file.' });
      }
    });

    // Handle errors
    downloadStream.on('error', (err) => {
      console.error('Download error:', err);
      res.status(500).json({ error: 'Error retrieving file.' });
    });

  } catch (error) {
    console.error('Error retrieving file:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
