const express = require('express');
const router = express.Router();
const meetingsController = require('../controllers/meetings.controller');
const { authMiddleware, adminOrHeadOnly } = require('../middlewares/auth.middleware'); 

router.post('/create', authMiddleware, adminOrHeadOnly, meetingsController.createMeeting);
router.get('/', authMiddleware, meetingsController.getAllMeetings);
router.get('/upcoming', authMiddleware, meetingsController.getUpcomingMeetings);
router.get('/ongoing', authMiddleware, meetingsController.getOngoingMeetings);
router.get('/past', authMiddleware, meetingsController.getPastMeetings);
router.get('/:id', authMiddleware, meetingsController.getMeetingById);

module.exports = router;