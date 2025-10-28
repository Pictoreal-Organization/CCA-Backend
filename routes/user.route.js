const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');

router.post('/request-password-change', authMiddleware, userController.requestPasswordChange);
router.post('/change-password-otp', authMiddleware, userController.changePasswordWithOTP);
router.put('/update-profile', authMiddleware, userController.updateUserProfile);
router.get('/all', authMiddleware, userController.getAllUsers);
router.get('/me', authMiddleware, userController.getLoggedInUser);

module.exports = router;
