const express = require('express');
const router = express.Router();
const User = require('../modules/user.module.js');
const jwt = require('jsonwebtoken');
const ObjectId=require('mongoose').Types.ObjectId;

require('dotenv').config();

module.exports = {
    getAllUsers: getAllUsers,
    getUserById: getUserById,
    createUser: createUser,
    updateUser: updateUser,
    deleteUser:deleteUser
}


function getAllUsers(req, res) {
    User.find()
        .then(users => res.status(200).json(users))
        .catch(err => {
            console.error(err.message);
            res.status(500).json({ error: 'Failed to fetch users' });
        });
}



async function getUserById(req, res) {
    let userId = req.params.userId;
    
    try {
        let user = await User.findById(userId);
        
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.status(200).json(user);
    } catch (err) {
        console.error("Internal server error:", err.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

const createToken = (id) => {
    return jwt.sign({ id }, process.env.JWTSecret, {
        expiresIn: 2 * 60 * 60
    });
}

async function createUser(req, res) {

    newUser = await User.create(req.body);
    const token =  createToken(newUser._id);
    res.cookie('jwt', token, {httpOnly: true, maxAge: 2 * 60 * 60 * 1000});
    res.status(201).json({newUser: newUser._id});
}

async function updateUser(req, res) {
    const userId = req.params.userId; 

    const updatedUserData = req.body; 
    try {
        const user = await User.findById(userId); 

        if (!user) {
            return res.status(404).json({ error: 'User not found' }); 
        }

        
        user.userName = updatedUserData.userName || user.usertName;
        user.mobileNo = updatedUserData.mobileNo || user.mobileNo;
        user.emailID = updatedUserData.emailID || user.emailID;
        user.password = updatedUserData.password || user.password;

        await user.save();

        res.status(200).json(user); 
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
}


async function deleteUser(req, res) {
    const userId = req.params.userId; 

    try {
        const user = await User.findByIdAndDelete(userId);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' }); 
        }

        return res.status(204).end(); 
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Internal server error' }); 
    }
}


