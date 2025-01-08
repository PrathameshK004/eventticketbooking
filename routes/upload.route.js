
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


 