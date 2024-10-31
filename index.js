const express = require('express');
require('./jobs/cronJobs');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const path = require('path');
const methodOverride = require('method-override');
let indexRouter = require('./routes/index');
const uploadRoutes = require('./routes/upload.route');
const retrieveRoutes = require('./routes/retrieve.route');
const cors = require("cors");
const cookieParser = require('cookie-parser');

const app = express();
require('dotenv').config();
app.use(cookieParser());

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(methodOverride('_method'));
app.use(cors());

// MongoDB URI
const mongoURI = process.env.CONNECTIONSTRING;

// Connect to MongoDB
mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('MongoDB connected successfully.');
}).catch(err => {
  console.error('MongoDB connection error:', err);
});

// Serve Frontend only at /file
app.get('/file', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Define your upload and retrieve routes
app.use('/file/upload', uploadRoutes);
app.use('/file/retrieve', retrieveRoutes);


// Port Configuration
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "PUT,GET,POST,PATCH");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-Requested-With,content-type,Origin,Accept,Authorization"
  );
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

app.use('/api', indexRouter);


// 404 Error Handling
app.use((req, res) => {
  res.status(404).json({ error: 'Resource not found' });
});
