
let express = require("express");
let router = express.Router();
let usersController = require('../controllers/user.controller');
let userInterceptor = require('../interceptor/user.interceptor');
let verifyToken = require('../interceptor/auth.interceptor')

router.get('/allUsers', verifyToken, usersController.getAllUsers);
router.get('/checkAuth', verifyToken, (req, res) => {
    res.status(200).json({ isAuthenticated: true, userKey: req.userKey});
});
router.get('/logout', usersController.logoutUser);
router.get('/:userId', verifyToken, userInterceptor.validateUserId, usersController.getUserById);
router.post('/login', userInterceptor.checkLogin, usersController.validateLogin);
router.post('/loginGoogle', userInterceptor.checkLogin, usersController.validateLoginGoogle);
router.post('/addUser', userInterceptor.validateNewUser, usersController.createUser);
router.post('/addUserGoogle', userInterceptor.validateNewUserGoogle, usersController.createUserGoogle);
router.put('/:userId', verifyToken, userInterceptor.validateUserId, userInterceptor.validateUpdateUser, usersController.updateUser);
router.delete('/:userId', verifyToken, userInterceptor.validateUserId, usersController.deleteUser);
router.post("/sendOtp", userInterceptor.validateOtpReq, usersController.sendOTP);
router.post('/login/admin', userInterceptor.checkAdminLogin, usersController.validateAdminLogin);
router.post("/forgotPassword", userInterceptor.checkForgotPassword, usersController.forgotPassword);
router.post('/makeAdmin/:userId',verifyToken, userInterceptor.validateAdmin, usersController.makeAdmin);
router.post('/makeOrganizer/:userId',verifyToken, userInterceptor.validateAdmin, usersController.makeOrg);

module.exports = router;


