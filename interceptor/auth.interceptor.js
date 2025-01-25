const jwt = require('jsonwebtoken');
const User = require('../modules/user.module.js');

// Middleware to verify the JWT
const verifyToken = async (req, res, next) => {
    const token = req.cookies.jwt || req.headers['authorization']?.split(' ')[1] || req.query.token;

    if (req.headers['test'] === process.env.TEST_TOKEN) {
        console.log("Static test token validated");
        return next(); // Bypass JWT verification for Postman testing
    }

    if (!token) {
        return res.status(403).json({ message: 'No token provided, access denied!' });
    }

    // Verify the token
    jwt.verify(token, process.env.JWTSecret, async (err, decoded) => {
        if (err) {
            return res.status(401).json({ message: 'Unauthorized!' });
        }

        let userId = decoded.key;

        try {
            let user = await User.findById(userId);

            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }

            req.userKey = user._id; // Set the username from the user object
            next(); // Call the next middleware or route handler
        } catch (err) {
            console.error("Internal server error:", err.message);
            res.status(500).json({ message: "Internal Server Error" });
        }
    });
};

module.exports = verifyToken;
