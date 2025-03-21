const Feedback = require('../modules/feedback.module.js');
const Token = require('../modules/token.module.js');

module.exports = {
    giveFeedback
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
                            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                            .container { max-width: 500px; margin: 0 auto; }
                            h1 { color: #FF6347; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <h1>Feedback Already Responded or Expired</h1>
                            <p>Sorry, but this feedback link is no longer valid.</p>
                            <p>The token has either been used or has expired.</p>
                        </div>
                    </body>
                </html>
            `);
        }

        tokenDoc.used = true;
        await tokenDoc.save();

        // Validate rating (ensure it's between 1 and 5)
        if (isNaN(parsedRating) || parsedRating < 1 || parsedRating > 5) {
            return res.status(400).json({ error: "Invalid rating. Please provide a value between 1 and 5." });
        }

        let feedback = await Feedback.findOne({ bookingId });

        if (!feedback) {
            return res.status(404).json({ error: "Feedback not found." });
        }

        if (feedback.status !== "Pending") {
            return res.status(400).json({ error: "Feedback is already submitted and cannot be changed." });
        }

        feedback.rating = parsedRating;
        feedback.status = "Completed";
        await feedback.save();
        
        return res.send(`
            <html>
                <head>
                    <title>Thank You</title>
                    <style>
                        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                        .container { max-width: 500px; margin: 0 auto; }
                        h1 { color: #7B68EE; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>Thank You for Your Feedback!</h1>
                        <p>You rated the event ${rating} star${rating !== '1' ? 's' : ''}.</p>
                        <p>Your feedback has been recorded. You can now close this window.</p>
                    </div>
                </body>
            </html>
        `);
    } catch (error) {
        console.error("Error saving feedback:", error);
        res.status(500).json({ error: "Error saving feedback", details: error.message });
    }
}

