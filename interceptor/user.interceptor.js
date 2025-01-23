
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser')
const User = require('../modules/user.module');
const validator = require('validator');
const app = express();
app.use(bodyParser.json());
module.exports = {
  checkLogin,
  checkLoginGoogle,
  validateUserId,
  validateNewUserGoogle,
  validateNewUser,
  validateUpdateUser,
  checkAdminLogin,
  validateOtpReq,
  validateAdmin,
  validateNewTempUser

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

  const { userName, emailID, code } = req.body;

  if (!userName || !code || !emailID) {
    return res.status(400).json({ error: 'UserName, Email and OTP are required fields.' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(emailID)) {
    return res.status(400).json({ error: 'Invalid email format.' });
  }

  try {
    const existingUser = await User.findOne({ emailID: emailID });
    if (existingUser && !existingUser.isTemp) {
      return res.status(400).json({ error: 'Email already exist.' });
    }
  } catch (err) {
    return res.status(500).json({ error: 'Error checking for existing user.' });
  }

  next();
}

async function validateNewTempUser(req, res, next) {

  const { userName, emailID } = req.body;

  if (!userName || !emailID) {
    return res.status(400).json({ error: 'UserName and Email are required fields.' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(emailID)) {
    return res.status(400).json({ error: 'Invalid email format.' });
  }

  next();
}


async function validateNewUserGoogle(req, res, next) {

  const { userName, emailID, passwordGoogle } = req.body;

  if (!userName || !passwordGoogle || !emailID) {
    return res.status(400).json({ error: 'UserName, Email and password are required fields.' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(emailID)) {
    return res.status(400).json({ error: 'Invalid email format.' });
  }

  try {
    const existingUser = await User.findOne({ emailID: emailID });
    if (existingUser && !existingUser.isTemp) {
      return res.status(400).json({ error: 'Email already exist.' });
    }
  } catch (err) {
    return res.status(500).json({ error: 'Error checking for existing user.' });
  }

  next();
}

async function validateUpdateUser(req, res, next) {
  const { userName, emailID } = req.body;

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


function checkLoginGoogle(req, res, next) {

  const { emailID, password } = req.body;

  if (!password || !emailID) {
    return res.status(400).json({ error: 'Email and password are required fields.' });
  }
  if (password < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
  }
  next();
}

function checkLogin(req, res, next) {

  const { emailID, code } = req.body;

  if (!code || !emailID) {
    return res.status(400).json({ error: 'Email and OTP are required fields.' });
  }
  if (code.toString().length !== 4) {
    return res.status(400).json({ error: 'OTP must be 4 digits.' });
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

  const validPurposes = ["Admin Login", "Sign In","Sign Up"];
  if (!validPurposes.includes(purpose)) {
    return res.status(400).json({ error: 'Purpose must be "AdminLogin", "Sign In" or "Sign Up".' });
  }

  next(); 
}


async function validateAdmin(req, res, next){
  const userId=req.params.userId;
  const { adminUserId } = req.body;

  if(!userId){
    return res.status(400).json({ error: "User ID is Required"});
  }
  if(!isUuidValid(userId)){
    return res.status(400).json({ error: "Invalid userId. Please provide a valid UUID."});
  }
  if(!adminUserId || !isUuidValid(adminUserId)){
    return res.status(403).json({ error: "Admin UserId is not Valid."});
  }


  next();
}
