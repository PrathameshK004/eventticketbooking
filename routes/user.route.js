let express = require("express");
let router = express.Router();
let usersController = require('../controllers/user.controller');
let userInterceptor = require('../interceptor/user.interceptor')

router.get('/allUsers', usersController.getAllUsers);
router.get('/:userId', userInterceptor.validateUserId, usersController.getUserById);
router.post('/login', userInterceptor.checkLogin, usersController.validateLogin);
router.post('/addUser', userInterceptor.validateNewUser,usersController.createUser);
router.put('/:userId', userInterceptor.validateUserId, userInterceptor.validateUpdateUser, usersController.updateUser);
router.delete('/:userId', userInterceptor.validateUserId,usersController.deleteUser)
module.exports = router;