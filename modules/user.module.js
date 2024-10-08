const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
    userName: { type: String},
    mobileNo: { type: Number},
    emailID: { type: String},
    password: { type: String}
});



userSchema.pre('save', async function(next){
    if (this.isModified('password')) {
        const salt = await bcrypt.genSalt();
        this.password = await bcrypt.hash(this.password, salt);
    }
    next();
});

// static method to login user
userSchema.statics.login = async function(mobileNo, password) {
    const user = await this.findOne({ mobileNo });
    if (user) {
      const auth = await bcrypt.compare(password, user.password);
      if (auth) {
        return user;
      }
      throw Error('Incorrect Password');
    }
    throw Error('Incorrect Mobile Number');
  };

const User = mongoose.model('User', userSchema);
module.exports= User;