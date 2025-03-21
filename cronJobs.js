const cron = require('node-cron');
const mongoose = require('mongoose');
const { GridFSBucket } = require('mongodb');
const nodemailer = require('nodemailer');
const moment = require('moment');
const ObjectId = require('mongoose').Types.ObjectId;
const jwt = require('jsonwebtoken');
const AdminNotification = require('./modules/adminNotification.module.js'); // 10 days old
const Event = require('./modules/event.module.js'); // isLive to false with startTime and delete 1 month
const User = require('./modules/user.module.js');
const Wallet = require('./modules/wallet.module.js');
const Enquiry = require('./modules/enquiry.module.js'); // 1 month old
const Notification = require('./modules/notification.module.js'); // 10 days old
const Token = require('./modules/token.module.js'); // If expired
const Coupon = require('./modules/coupon.module.js'); // If expired
const Reward = require('./modules/reward.module.js'); // If expired
const Booking = require('./modules/bookingdetails.module.js'); // If expired
const Feedback = require('./modules/feedback.module.js'); // If expired

// Initialize GridFSBuckets for different collections
let eventBucket, enquiryBucket;

const conn = mongoose.connection;
conn.once('open', () => {
    eventBucket = new GridFSBucket(conn.db, { bucketName: 'uploads' }); // For event files
    enquiryBucket = new GridFSBucket(conn.db, { bucketName: 'enquiryUploads' }); // For enquiry files
});

const createToken = (key) => {
    return jwt.sign({ key }, process.env.JWTSecret, {
        expiresIn: '30d' // Token expires in 30 days
    });
};


// Function to delete expired tokens
async function deleteExpiredTokens() {
    try {
        const result = await Token.deleteMany({ expiresAt: { $lt: new Date() } });
        console.log(`Deleted expired tokens: ${result.deletedCount}`);
    } catch (err) {
        console.error('Error deleting expired tokens:', err);
    }
}

// Function to delete expired coupons
async function deleteExpiredCoupons() {
    try {
        const result = await Coupon.deleteMany({ expirationDate: { $lt: new Date() } });
        console.log(`Deleted expired coupons: ${result.deletedCount}`);
    } catch (err) {
        console.error('Error deleting expired coupons:', err);
    }
}

// Function to delete expired rewards
async function deleteExpiredRewards() {
    try {
        const result = await Reward.deleteMany({ expiresAt: { $lt: new Date() } });
        console.log(`Deleted expired rewards: ${result.deletedCount}`);
    } catch (err) {
        console.error('Error deleting expired rewards:', err);
    }
}

// Function to delete expired feedbacks
async function deleteExpiredFeedbacks() {
    try {
        const expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() - 30); // Set to 30 days ago

        const result = await Feedback.deleteMany({ createdAt: { $lt: expirationDate } });

        console.log(`Deleted expired feedbacks: ${result.deletedCount}`);
    } catch (err) {
        console.error('Error deleting expired feedbacks:', err);
    }
}


// Function to update lose rewards
async function updateLoseRewards() {
    try {
        const result = await Reward.updateMany(
            { isRevealed: true, type: 'lose', isRedeemed: false },
            { $set: { isRedeemed: true } }
        );
        console.log(`Updated revealed lose rewards to redeemed: ${result.nModified}`);
    } catch (err) {
        console.error('Error updating lose rewards:', err);
    }
}


async function deletePastEvents() {
    try {
        const pastEvents = await Event.find(); // Fetch all events

        // Current time in UTC
        const nowUTC = new Date();

        // Convert to IST by adding 5 hours and 30 minutes
        const nowIST = new Date(nowUTC.getTime() + (5.5 * 60 * 60 * 1000));

        for (const event of pastEvents) {
            if (!event.eventTime || !event.eventDate) {
                continue;
            }

            // Extract the start time and end time
            const timeComponents = event.eventTime.split('-');
            if (timeComponents.length !== 2) {
                continue;
            }

            const startTimeStr = timeComponents[0].trim();
            const endTimeStr = timeComponents[1].trim();

            // Parse dates in IST context
            const eventDateStr = moment(event.eventDate).format('YYYY-MM-DD');

            // Create moment objects for start time
            const eventStartMoment = moment(`${eventDateStr} ${startTimeStr}`, 'YYYY-MM-DD hh:mm A');

            // Check if end time is in AM and start time is in PM, indicating overnight event
            const isStartPM = startTimeStr.includes('PM');
            const isEndAM = endTimeStr.includes('AM');

            // For end time, determine if we need to add a day
            let eventEndMoment;
            if (isStartPM && isEndAM) {
                // If start is PM and end is AM, end time is on the next day
                const nextDay = moment(eventDateStr).add(1, 'days').format('YYYY-MM-DD');
                eventEndMoment = moment(`${nextDay} ${endTimeStr}`, 'YYYY-MM-DD hh:mm A');
            } else {
                // Same day event
                eventEndMoment = moment(`${eventDateStr} ${endTimeStr}`, 'YYYY-MM-DD hh:mm A');
            }

            if (!eventStartMoment.isValid() || !eventEndMoment.isValid()) {
                continue;
            }

            // Convert moment objects to Date objects
            const eventFullDateStartTime = eventStartMoment.toDate();
            const eventFullDateEndTime = eventEndMoment.toDate();

            // Compare using IST times
            const startPassed = eventFullDateStartTime <= nowIST;

            // If event is live and start time has passed in IST, mark as not live
            if (event.isLive && startPassed) {
                console.log(`Marking event ${event._id} as not live (IST comparison)`);
                await Event.updateOne({ _id: event._id }, { $set: { isLive: false } });
                event.isLive = false;
            }

            // Process hold amount refund logic - also using IST time
            if (!event.isLive && eventFullDateEndTime <= nowIST && event.holdAmount > 0) {
                const refundAmount = event.holdAmount;

                let wallet = await Wallet.findOne({ userId: event.userId });
                if (!wallet) {
                    console.error(`  Wallet not found for user ${event.userId}`);
                    continue;
                }

                // Record transaction in wallet
                wallet.balance += refundAmount;
                wallet.transactions.push({
                    amount: refundAmount,
                    type: 'Credit',
                    description: `Release of hold balance of event: ${event.eventTitle}`
                });
                await wallet.save();
                event.holdAmount = 0;
                console.log(`Release of hold balance of event: ${event.eventTitle} to ${event.userId}`);
                await event.save();
            }


            if (eventFullDateEndTime <= nowIST) {
                const bookings = await Booking.find({ eventId: event._id, book_status: "Completed" });

                for (const booking of bookings) {
                    const existingFeedback = await Feedback.findOne({ bookingId: booking._id });

                    if (!existingFeedback) {
                        await Feedback.create({
                            bookingId: booking._id,
                            eventId: event._id,
                            userId: booking.userId,
                            status: 'Pending',
                        });

                        const user = await User.findById(booking.userId);
                        if (user && user.emailID) {
                            await sendFeedbackEmail(user.emailID, event.eventTitle, event.imageUrl, booking._id.toString(), user._id, user.userName);
                            console.log(`Sent feedback email to ${user.emailID}`);
                        }
                    }
                }
            }

            // Add 30 days (1 month) to the event date for deletion threshold - in IST
            const deletionThreshold = moment(eventFullDateStartTime).add(30, 'days').toDate();

            // Check if the event is now older than 30 days after end time - in IST
            if (deletionThreshold < nowIST) {
                console.log(`  Deleting event ${event._id}`);

                // Delete associated files
                if (event.fileId) {
                    try {
                        await eventBucket.delete(new ObjectId(event.fileId));
                        console.log(`  Deleted file ${event.fileId}`);
                    } catch (fileErr) {
                        console.error(`  Error deleting file ${event.fileId}:`, fileErr);
                    }
                }

                // Remove event references from User collection
                try {
                    const userUpdateResult = await User.updateMany(
                        { eventId: event._id },
                        { $pull: { eventId: event._id } }
                    );
                    console.log(`  Updated ${userUpdateResult.nModified} users`);
                } catch (userErr) {
                    console.error(`  Error updating users:`, userErr);
                }

                // Delete admin notification
                try {
                    const eventDetailsId = new ObjectId(event._id);
                    const adminNoti = await AdminNotification.findOne({ eventDetails: eventDetailsId });

                    if (adminNoti) {
                        await AdminNotification.findByIdAndDelete(adminNoti._id);
                        console.log(`  Deleted admin notification ${adminNoti._id}`);
                    } else {
                        console.log(`  No admin notification found for event ${event._id}`);
                    }
                } catch (notiErr) {
                    console.error(`  Error handling admin notification:`, notiErr);
                }

                // Delete the event
                try {
                    const deletedEvent = await Event.findByIdAndDelete(event._id);
                    if (deletedEvent) {
                        console.log(`  Successfully deleted event ${event._id}`);
                    } else {
                        console.error(`  Failed to delete event ${event._id} (Not found)`);
                    }
                } catch (deleteErr) {
                    console.error(`  Error deleting event:`, deleteErr);
                }
            }
        }

    } catch (err) {
        console.error('Error in deletePastEvents function:', err);
    }
}

async function sendFeedbackEmail(userEmail, eventTitle, eventImageUrl, bookingId, userId, username) {
    try {
        // Create auth token for secure feedback submission
        const token = createToken(userId);
        await Token.create({
            token,
            userId: userId,
            used: false,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
        });
        
        // Set up email transporter
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL,
                pass: process.env.EMAIL_PASSWORD,
            },
        });
        
        // Generate star rating links with direct API calls
        const stars = [1, 2, 3, 4, 5]
            .map(
                (rating) =>
                    `<a href="https://eventticketbooking-cy6o.onrender.com/api/feedback/giveFeedback/${bookingId}/${rating}/${token}" 
                        style="font-size: 30px; color: gold; text-decoration: none; margin: 0 5px;"
                        target="_blank" 
                        title="Rate ${rating} stars">★</a>`
            )
            .join('');

            const mailOptions = {
                from: process.env.EMAIL,
                to: userEmail,
                subject: `Rate Your Experience: ${eventTitle}`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border-radius: 8px; background-color: #f9f9f9; border: 1px solid #ddd;">
                        
                        <!-- Header Section -->
                        <div style="text-align: center; background-color: #030711; padding: 15px; border-radius: 8px 8px 0 0;">
                            <img src="https://i.imgur.com/sx36L2V.png" alt="EventHorizon Logo" style="max-width: 80px;">
                            <h2 style="color: #ffffff; margin: 10px 0;">We Value Your Feedback!</h2>
                        </div>
            
                        <!-- Feedback Request -->
                        <div style="background-color: #ffffff; padding: 20px; border-radius: 0 0 8px 8px;">
                            <p style="font-size: 16px;">Dear ${username},</p>
                            <p>Thank you for attending <strong>${eventTitle}</strong>! We would love to hear your thoughts about your experience.</p>
            
                            ${eventImageUrl ? `<div style="text-align: center; margin: 20px 0;">
                                <img src="${eventImageUrl}" alt="${eventTitle}" style="max-width: 120px; border-radius: 5px;">
                            </div>` : ''}
            
                            <h3 style="color: #0078ff; margin-top: 20px; text-align: center;">Click a star to rate your experience:</h3>
                            <div style="text-align: center; font-size: 30px; margin-top: 10px;">
                                ${stars}
                            </div>
                            <p style="font-size: 12px; color: #777; text-align: center; margin-top: 10px;">
                                (Rating is submitted immediately when you click a star)
                            </p>
            
                            <p style="color: #555; margin-top: 20px;">Your feedback helps us improve future events. We appreciate your time!</p>
                            
                            <p style="text-align: center; color: gray; font-size: 12px; margin-top: 20px;">
                                Thank you for your time!<br>Best Regards, <br>EventHorizon Team
                            </p>
                        </div>
            
                        <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
            
                        <!-- Footer -->
                        <p style="color:gray; font-size:12px; text-align: center;">This is an autogenerated message. Please do not reply to this email.</p>
                    </div>
                `,
            };
            

        await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error(`Error sending feedback email to ${userEmail}:`, error);
    }
}



// Function to delete old enquiries (older than 1 month)
async function deleteOldEnquiries() {
    try {
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

        const oldEnquiries = await Enquiry.find({ createdAt: { $lt: oneMonthAgo } });

        for (const enquiry of oldEnquiries) {
            // Delete associated files from the "enquiryUploads" bucket
            if (enquiry.fileId) {
                await enquiryBucket.delete(new ObjectId(enquiry.fileId));
            }
            await Enquiry.deleteOne({ _id: enquiry._id });
        }

        console.log(`Deleted old enquiries: ${oldEnquiries.length}`);
    } catch (err) {
        console.error('Error deleting old enquiries:', err);
    }
}

// Function to delete old notifications (older than 10 days)
async function deleteOldNotifications() {
    try {
        const tenDaysAgo = new Date();
        tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

        const result = await Notification.deleteMany({ createdAt: { $lt: tenDaysAgo } });

        console.log(`Deleted old notifications: ${result.deletedCount}`);
    } catch (err) {
        console.error('Error deleting old notifications:', err);
    }
}

// Function to schedule all deletions
async function scheduleDataDeletion() {
    await deleteExpiredTokens();
    await deletePastEvents();
    await deleteOldEnquiries();
    await deleteOldNotifications();
    await deleteExpiredCoupons();
    await deleteExpiredRewards();
    await deleteExpiredFeedbacks();
    await updateLoseRewards();
}

// Run cleanup function every minute
cron.schedule('* * * * *', scheduleDataDeletion);

console.log('Cron jobs scheduled for automatic data cleanup.');