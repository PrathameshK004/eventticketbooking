const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
    userName: { type: String },
    emailID: { type: String },
    roles: {
        type: [Number],
        enum: [0, 1, 2] // 0: User, 1: Organizer, 2: Admin
    },
    imageUrl: { type: String },
    isGoogle: { type: Boolean, default: false },
    passwordGoogle: { type: String },
    isTemp: { type: Boolean, default: false },
    code: { type: String }, // Changed to String
    codeExpiry: { type: Date } // OTP Expiry
});

userSchema.pre('save', function (next) {
    if (!this.roles.includes(0)) {
        this.roles.unshift(0);
    }
    this.roles = [...new Set(this.roles)];
    next();
});

userSchema.pre('save', async function (next) {
    if (this.isModified('passwordGoogle')) {
        const salt = await bcrypt.genSalt();
        this.passwordGoogle = await bcrypt.hash(this.passwordGoogle, salt);
    }
    if (this.isModified('code')) { // Check if the code is modified
        const salt = await bcrypt.genSalt();
        this.code = await bcrypt.hash(this.code, salt); // Hash the code
    }
    next();
});

userSchema.statics.loginWithGoogle = async function(emailID, password) {
    const user = await this.findOne({ emailID: emailID });
    if (user) {
        const auth = await bcrypt.compare(password, user.passwordGoogle);
        if (auth) {
            return user;
        }
        throw Error('Incorrect password');
    }
    throw Error('Email not registered');
};

const User = mongoose.model('User', userSchema);
module.exports = User;
