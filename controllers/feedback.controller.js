const Feedback = require("../modules/feedback.module.js");
const Token = require("../modules/token.module.js");
const User = require("../modules/user.module.js");
const Event = require("../modules/event.module.js");
const Booking = require("../modules/bookingdetails.module.js");

module.exports = {
  giveFeedback,
};

async function giveFeedback(req, res) {
  try {
    const { bookingId, rating, token } = req.params;
    const parsedRating = parseInt(rating, 10);

    const tokenDoc = await Token.findOne({ token });

    if (!tokenDoc || tokenDoc.used || tokenDoc.expiresAt < new Date()) {
      return res.status(400).json({
          success: false,
          message: "Feedback link is invalid or has expired."
      });
  }
  

    // Validate rating (ensure it's between 1 and 5)
    if (isNaN(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      return res.status(400).json({
        error: "Invalid rating. Please provide a value between 1 and 5.",
      });
    }

    let feedback = await Feedback.findOne({ bookingId });

    if (!feedback) {
      return res.status(404).json({ error: "Feedback not found." });
    }

    if (feedback.status !== "Pending") {
      return res.status(400).json({
        error: "Feedback is already submitted and cannot be changed.",
      });
    }

    feedback.rating = parsedRating;
    feedback.status = "Completed";
    await feedback.save();

    let booking = await Booking.findById(bookingId);
    let event = await Event.findById(booking.eventId);
    let user = await User.findById(event.userId);

    if (user.eventRating === 0) {
      user.eventRating = parsedRating;
    } else {
      user.eventRating = parseFloat(
        ((user.eventRating + parsedRating) / 2).toFixed(1)
      );
    }

    await user.save();

    // Mark token as used only after validation
    tokenDoc.used = true;
    await tokenDoc.save();

    res.json({
      success: true,
      message: `Thank you for your feedback! You rating has been recorded`,
      rating: parsedRating
  });
  

    // Now delete the token safely after response is sent
    await Token.deleteOne({ token });

  } catch (error) {
    console.error("Error saving feedback:", error);
    res.status(500).json({ error: "Error saving feedback", details: error.message });
  }
}
