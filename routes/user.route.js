
let express = require("express");
let router = express.Router();
let usersController = require('../controllers/user.controller');
let userInterceptor = require('../interceptor/user.interceptor');
let verifyToken = require('../interceptor/auth.interceptor');

router.get('/allUsers', verifyToken, usersController.getAllUsers);
router.get('/checkAuth', verifyToken, (req, res) => {
    res.status(200).json({ isAuthenticated: true, userKey: req.userKey});
});
router.get('/validate-token', verifyToken, (req, res) => {
    res.status(200).json({ isAuthenticated: true, userKey: req.userKey});
});

router.get('/logout', usersController.logoutUser);
router.get('/:userId', verifyToken, userInterceptor.validateUserId, usersController.getUserById);
router.post('/login', userInterceptor.checkLogin, usersController.validateLogin);
router.post('/loginOtp', userInterceptor.validateOtpReq, usersController.validateLoginOtp);
router.post('/loginGoogle', userInterceptor.checkLoginGoogle, usersController.validateLoginGoogle);
router.post('/addUser', userInterceptor.validateNewUser, usersController.createUser);
router.post('/addTempUser', userInterceptor.validateNewTempUser, usersController.createTempUser);
router.post('/addUserGoogle', userInterceptor.validateNewUserGoogle, usersController.createUserGoogle);
router.put('/:userId', verifyToken, userInterceptor.validateUserId, userInterceptor.validateUpdateUser, usersController.updateUser);
router.delete('/:userId', verifyToken, userInterceptor.validateUserId, usersController.deleteUser);
router.post("/sendOtp", userInterceptor.validateOtpReq, usersController.sendOTP);
router.post('/login/admin', userInterceptor.checkAdminLogin, usersController.validateAdminLogin);
router.post('/makeAdmin/:userId',verifyToken, userInterceptor.validateAdmin, usersController.makeAdmin);
router.post('/removeAdmin/:userId',verifyToken, userInterceptor.validateAdmin, usersController.removeAdmin);

module.exports = router;


