const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authMiddleware, adminOnly } = require('../middlewares/auth.middleware');

router.post('/register', authMiddleware, adminOnly, authController.register);
router.post('/login', authController.login);
router.post('/refresh', authController.refreshToken);
router.post('/logout', authController.logout);

router.post('/request-password-change', authController.requestPasswordChange);
router.post('/verify-otp', authController.verifyOTP);
router.post('/change-password-otp', authController.changePasswordWithOTP);

module.exports = router;
