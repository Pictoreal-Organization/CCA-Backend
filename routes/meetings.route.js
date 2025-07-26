const express = require('express');
const router = express.Router();
const meetingsController = require('../controllers/meetings.controller');

router.get('/', meetingsController.getAllMeetings);
router.get('/status/upcoming', meetingsController.getUpcomingMeetings);
router.get('/status/past', meetingsController.getPastMeetings);
router.get('/:id', meetingsController.getMeetingById);

module.exports = router;