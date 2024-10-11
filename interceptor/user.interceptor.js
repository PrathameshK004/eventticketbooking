const express = require('express');
const mongoose = require('mongoose');
const bodyParser=require('body-parser')
const User = require('../modules/user.module'); 
const app = express();
app.use(bodyParser.json());
module.exports = {
    checkLogin: checkLogin,
    validateUserId: validateUserId,
    validateNewUser:validateNewUser,
    validateUpdateUser: validateUpdateUser
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

  const { userName, mobileNo, emailID, password } = req.body;

  if (!userName || !password || !emailID) {
      return res.status(400).json({ error: 'UserName, Email and password are required fields.' });
  }

  if(mobileNo){
    const mobileRegex = /^[0-9]{10}$/;
    if (!mobileRegex.test(mobileNo)) {
      return res.status(400).json({ error: 'Invalid Mobile Number. It should be 10 digits.' });
    }
  }
  

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailID)) {
        return res.status(400).json({ error: 'Invalid email format.' });
    }
  

  if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
  }


  if(mobileNo){
    try {
      const existingUser = await User.findOne({ mobileNo: mobileNo });
      if (existingUser) {
        return res.status(400).json({ error: 'Mobile Number already exist.' });
      }
    } catch (err) {
      return res.status(500).json({ error: 'Error checking for existing user.' });
    }
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

  async function validateUpdateUser(req, res, next) {
    const { userName, mobileNo, emailID } = req.body;

    // If the client tries to update 'userName', 'mobileNo', or 'emailID', validate them
    
    if (mobileNo) {
        const mobileRegex = /^[0-9]{10}$/;
        if (!mobileRegex.test(mobileNo)) {
            return res.status(400).json({ error: 'Invalid Mobile Number. It should be 10 digits.' });
        }

        const existingUser = await User.findOne({ mobileNo });
        if (existingUser && existingUser._id.toString() !== req.params.userId) {
            return res.status(400).json({ error: 'Mobile Number already exists.' });
        }
    }

    if (emailID) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailID)) {
            return res.status(400).json({ error: 'Invalid email format.' });
        }

        const existingUser = await User.findOne({ emailID });
        if (existingUser && existingUser._id.toString() !== req.params.userId) {
            return res.status(400).json({ error: 'Email already exists.' });
        }
    }
    next();
  }




async function checkLogin(req, res, next) {

  const { mobile_email, password } = req.body;

  if (!password || !mobile_email) {
      return res.status(400).json({ error: 'Mobile Number / Email and password are required fields.' });
  }
  if (password < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long..' });
}
  next();
}