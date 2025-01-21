
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser')
const User = require('../modules/user.module');
const validator = require('validator');
const app = express();
app.use(bodyParser.json());
module.exports = {
  checkLogin: checkLogin,
  validateUserId: validateUserId,
  validateNewUserGoogle: validateNewUserGoogle,
  validateNewUser: validateNewUser,
  validateUpdateUser: validateUpdateUser,
  checkAdminLogin: checkAdminLogin,
  checkForgotPassword: checkForgotPassword,
  validateOtpReq: validateOtpReq
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

  if (mobileNo) {
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


  if (mobileNo) {
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


async function validateNewUserGoogle(req, res, next) {

  const { userName, mobileNo, emailID, passwordGoogle } = req.body;

  if (!userName || !passwordGoogle || !emailID) {
    return res.status(400).json({ error: 'UserName, Email and password are required fields.' });
  }

  if (mobileNo) {
    const mobileRegex = /^[0-9]{10}$/;
    if (!mobileRegex.test(mobileNo)) {
      return res.status(400).json({ error: 'Invalid Mobile Number. It should be 10 digits.' });
    }
  }


  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(emailID)) {
    return res.status(400).json({ error: 'Invalid email format.' });
  }


  if (passwordGoogle.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
  }


  if (mobileNo) {
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




function checkLogin(req, res, next) {

  const { mobile_email, password } = req.body;

  if (!password || !mobile_email) {
    return res.status(400).json({ error: 'Mobile Number / Email and password are required fields.' });
  }
  if (password < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
  }
  next();
}


function checkAdminLogin(req, res, next) {

  const { emailID, code } = req.body;

  if (!code || !emailID) {
    return res.status(400).json({ error: 'Email and OTP are required fields.' });
  }
  if (code.toString().length !== 4) {
    return res.status(400).json({ error: 'OTP must be 4 digits.' });
  }
  next();
}

function checkForgotPassword(req, res, next) {

  const { emailID, code, newPassword } = req.body;

  if (!code || !emailID || !newPassword) {
    return res.status(400).json({ error: 'Email, Password and OTP are required fields.' });
  }
  if (code.toString().length !== 4) {
    return res.status(400).json({ error: 'OTP must be 4 digits.' });
  }
  if (newPassword < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
  }
  next();
}

function validateOtpReq(req, res, next) {
  const { emailID, purpose } = req.body;

  if (!emailID || !purpose) {
    return res.status(400).json({ error: 'Both emailID and purpose are required fields.' });
  }

  if (!validator.isEmail(emailID)) {
    return res.status(400).json({ error: 'Invalid email format.' });
  }

  if (typeof purpose !== 'string') {
    return res.status(400).json({ error: 'Purpose must be a string.' });
  }

  const validPurposes = ["AdminLogin", "ForgotPassword"];
  if (!validPurposes.includes(purpose)) {
    return res.status(400).json({ error: 'Purpose must be "AdminLogin" or "ForgotPassword".' });
  }

  next(); 
}
