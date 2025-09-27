const express = require('express');
const router = express.Router();
const meetingsController = require('../controllers/meetings.controller');
const { authMiddleware, adminOrHeadOnly } = require('../middlewares/auth.middleware'); 

router.post('/create', authMiddleware, adminOrHeadOnly, meetingsController.createMeeting);
router.get('/', meetingsController.getAllMeetings);
router.get('/status/upcoming', meetingsController.getUpcomingMeetings);
router.get('/status/past', meetingsController.getPastMeetings);
router.get('/:id', meetingsController.getMeetingById);

module.exports = router;