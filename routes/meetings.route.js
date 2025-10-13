const express = require('express');
const router = express.Router();
const meetingsController = require('../controllers/meetings.controller');
const { authMiddleware, adminOrHeadOnly, adminOnly } = require('../middlewares/auth.middleware'); 

router.post('/create', authMiddleware, adminOrHeadOnly, meetingsController.createMeeting);
router.get('/', authMiddleware, meetingsController.getAllMeetings);
router.get('/status/:status', authMiddleware, meetingsController.getMeetingsByStatus);
router.get('/all/status/:status', authMiddleware, adminOnly, meetingsController.getAllMeetingsByStatus);
router.get('/:id', authMiddleware, meetingsController.getMeetingById);
router.get('/attendance/pending', authMiddleware, adminOrHeadOnly, meetingsController.getMeetingsForAttendance);

module.exports = router;