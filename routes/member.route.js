const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller'); // adjust path

// Update member profile route (admin or member)
router.put('/member/:userId', adminController.updateMemberProfile);

module.exports = router;
