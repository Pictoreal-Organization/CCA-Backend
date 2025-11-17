const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');


router.put('/update-profile', authMiddleware, userController.updateUserProfile);
router.get('/all', authMiddleware, userController.getAllUsers);
router.get('/me', authMiddleware, userController.getLoggedInUser);

module.exports = router;
