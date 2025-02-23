const express = require('express');
const router = express.Router();
const walletController = require('../controllers/wallet.controller');
let verifyToken = require('../interceptor/auth.interceptor')
let walletInterceptor = require('../interceptor/wallet.interceptor');


router.get('/getWalletDetails/:userId', verifyToken, walletInterceptor.validateUserWallet, walletController.getWalletBalance);
router.put('/updateWallet/:userId', verifyToken, walletInterceptor.validateUserWallet, walletInterceptor.validateUpdateWallet, walletController.updateWallet);
router.delete('/deleteWallet/:userId', verifyToken, walletInterceptor.validateUserWallet ,walletController.deleteWallet);
router.post('/transferToBank/:userId', verifyToken, walletInterceptor.validateUserWallet, walletInterceptor.validateTransferToBank, walletController.transferToBank);

//Admin Wallet
router.get('/adminWallet/getWalletDetails', verifyToken, walletInterceptor.validateAdminWallet, walletController.getWalletBalance);
router.put('/adminWallet/updateWallet', verifyToken, walletInterceptor.validateAdminWallet, walletInterceptor.validateUpdateWallet, walletController.updateWallet);

module.exports = router;
