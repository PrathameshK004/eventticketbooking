const express = require('express');
const mongoose = require('mongoose');
const Enquiry = require('../modules/enquiry.module');
const User = require('../modules/user.module');

const app = express();
app.use(express.json());

module.exports = {
    validateEnquiryId,
    validateUserId,
    validateNewEnquiry,
    validateEnquiryResponse,
    validateAdminAndEnquiry,
    validateNewOrgEnquiry
};

function isUuidValid(id) {
    return mongoose.Types.ObjectId.isValid(id);
}

function validateEnquiryId(req, res, next) {
    const { enquiryId } = req.params;
    if (!enquiryId) {
        return res.status(400).json({ error: 'Enquiry ID is required.' });
    }
    if (!isUuidValid(enquiryId)) {
        return res.status(400).json({ error: 'Invalid enquiry ID. Please provide a valid UUID.' });
    }
    next();
}

async function validateAdminAndEnquiry(req, res, next) {
    const { adminId } = req.params;
    if (!adminId) {
        return res.status(400).json({ error: 'Admin ID is required.' });
    }
    if (!isUuidValid(adminId)) {
        return res.status(400).json({ error: 'Invalid enquiry ID. Please provide a valid UUID.' });
    }

    const user = await User.findById( adminId );
    if(!user){
        return res.status(400).json({ error: 'User not found' });
    }
    if(!user.roles.includes(2)){
        return res.status(403).json({ message: 'You are not Admin' })
    }

    next();
}

async function validateUserId(req, res, next) {
    const { userId } = req.body || req.params.userId;
    if (!userId || !isUuidValid(userId)) {
        return res.status(400).json({ error: 'User ID is required and must be a valid UUID.' });
    }
    try {
        const userExists = await User.findById(userId);
        if (!userExists || userExists.isTemp) {
            return res.status(404).json({ error: 'User ID not found in the database.' });
        }
        next();
    } catch (error) {
        res.status(500).json({ error: 'An error occurred while validating the user ID. ' + error });
    }
}

async function validateNewEnquiry(req, res, next) {
    const { userId, type, message } = req.body;

    if (!userId || !type )  {
        return res.status(400).json({ error: 'User ID and type are required fields.' });
    }
    if (!isUuidValid(userId)) {
        return res.status(400).json({ error: 'User ID must be a valid UUID string.' });
    }

    if (!type || !['Event Request', 'Other'].includes(type)) {
        return res.status(400).json({ error: 'Type is required and must be either Event Request or Other' });
    }


    try {
        const userExists = await User.findById(userId);
        if (!userExists || userExists.isTemp) {
            return res.status(404).json({ error: 'User ID not found in the database.' });
        }
        if (type === 'Event Request' && !userExists.roles.includes(1)) {
            return res.status(400).json({ error: 'You are not Organizer to Request Add Event' });
        }
    } catch (error) {
        return res.status(500).json({ error: 'An error occurred while validating the user ID. ' + error });
    }

    next();
}

async function validateNewOrgEnquiry(req, res, next) {
    const { userId, type } = req.body;

    if (!userId || !type )  {
        return res.status(400).json({ error: 'User ID and type are required fields.' });
    }
    if (!isUuidValid(userId)) {
        return res.status(400).json({ error: 'User ID must be a valid UUID string.' });
    }

    if (!type || !['Organizer Request'].includes(type)) {
        return res.status(400).json({ error: 'Type is required and must be Organizer Request' });
    }


    try {
        const userExists = await User.findById(userId);
        if (!userExists || userExists.isTemp) {
            return res.status(404).json({ error: 'User ID not found in the database.' });
        }
        if (userExists.roles.includes(1)) {
            return res.status(400).json({ error: 'You are already an Organizer.' });
        }        
    } catch (error) {
        return res.status(500).json({ error: 'An error occurred while validating the user ID. ' + error });
    }

    next();
}

async function validateEnquiryResponse(req, res, next) {
    const { enquiryId } = req.params;
    const { status, remarks } = req.body;

    if (!isUuidValid(enquiryId)) {
        return res.status(400).json({ error: 'Invalid enquiry ID. Please provide a valid UUID.' });
    }

    if (!status || !['Pending', 'Accepted', 'Rejected'].includes(status)) {
        return res.status(400).json({ error: 'Status is required and must be either Pending, Accepted, or Rejected.' });
    }

    if (!remarks) {
        return res.status(400).json({ error: 'Status is required.' });
    }

    try {
        const existingEnquiry = await Enquiry.findById(enquiryId);
        if (!existingEnquiry) {
            return res.status(404).json({ error: 'Enquiry not found.' });
        }
        next();
    } catch (error) {
        res.status(500).json({ error: 'An error occurred while validating the enquiry. ' + error });
    }
}
