const express = require('express');
const mongoose = require('mongoose');
const bodyParser=require('body-parser')
const User = require('../modules/user.module'); 
const app = express();
app.use(bodyParser.json());
module.exports = {
    validateUserId: validateUserId,
    validateNewUser:validateNewUser
}


function isUuidValid(userId) {
  
    return mongoose.Types.ObjectId.isValid(userId);
}

function validateUserId(req, res, next) {
    const userId = req.params.userId;
    if (!userId) {
        return res.status(400).json({ error: 'User ID is required.' });
    }
    if (!isUuidValid(userId)) {
        return res.status(400).json({ error: 'Invalid userId. Please provide a valid UUID.' });
    }
    next();
}
async function validateNewUser(req, res, next) {

  const { firstName, lastName, mobileNo, emailID, password } = req.body;

  if (!firstName || !lastName || !emailID || !password || !mobileNo) {
      return res.status(400).json({ error: 'First name, last name, Mobile Number, email ID, and password are required fields.' });
  }

  const mobileRegex = /^[0-9]{10}$/;
  if (!mobileRegex.test(mobileNo)) {
    return res.status(400).json({ error: 'Invalid Mobile Number. It should be 10 digits.' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(emailID)) {
      return res.status(400).json({ error: 'Invalid email format.' });
  }

  if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
  }

  try {
    const existingUser = await User.findOne({ emailID: emailID });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already exist.' });
    }
  } catch (err) {
    return res.status(500).json({ error: 'Error checking for existing user.' });
  }

  next();
}
