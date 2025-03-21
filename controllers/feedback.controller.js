const Feedback = require("../modules/feedback.module.js");
const Token = require("../modules/token.module.js");
const User = require("../modules/user.module.js");
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
      return res.status(400).send(`
        <html>
        <head>
          <title>Feedback Error</title>
          <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background-color: #f9f9f9; }
              .container { max-width: 500px; margin: 0 auto; padding: 20px; background: white; border-radius: 8px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1); }
              h1 { color: #7B68EE; }
              p { color: #333; }
          </style>
        </head>
        <body>
          <div class="container">
              <h1>Feedback Already Responded or Expired</h1>
              <p>Sorry, but this feedback link is no longer valid.</p>
              <p>The feedback has either responded or has expired.</p>
          </div>
        </body>
        </html>
      `);
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
    let user = await User.findById(booking.userId);

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

    const responseHtml = `
      <html>
      <head>
        <title>Thank You</title>
        <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background-color: #f9f9f9; }
            .container { max-width: 500px; margin: 0 auto; padding: 20px; background: white; border-radius: 8px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1); }
            h1 { color: #7B68EE; }
            .stars { font-size: 30px; color: #FFD700; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
            <h1>Thank You for Your Feedback!</h1>
            <p>You rated the event ${parsedRating} star${parsedRating !== 1 ? "s" : ""}.</p>
            <div class="stars">
                ${"★".repeat(parsedRating)}${"☆".repeat(5 - parsedRating)}
            </div>
            <p>Your feedback has been recorded. You can now close this window.</p>
        </div>
      </body>
      </html>
    `;

    res.send(responseHtml);

    // Now delete the token safely after response is sent
    await Token.deleteOne({ token });

  } catch (error) {
    console.error("Error saving feedback:", error);
    res.status(500).json({ error: "Error saving feedback", details: error.message });
  }
}
