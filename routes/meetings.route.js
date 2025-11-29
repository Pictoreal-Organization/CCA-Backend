const express = require('express');
const router = express.Router();
const meetingsController = require('../controllers/meetings.controller');
const { authMiddleware, adminOrHeadOnly, adminOnly } = require('../middlewares/auth.middleware');

router.get('/:id/has-control', authMiddleware, meetingsController.getHasControl);
router.get('/quick-select/options', authMiddleware, adminOrHeadOnly, meetingsController.getQuickSelectOptions);
router.get('/quick-select/:option/members', authMiddleware, adminOrHeadOnly, meetingsController.getQuickSelectMembers);

// Create
router.post('/create', authMiddleware, adminOrHeadOnly, meetingsController.createMeeting);

// Read
router.get('/', authMiddleware, meetingsController.getAllMeetings);
router.get('/status/:status', authMiddleware, meetingsController.getMeetingsByStatus);
router.get('/all/status/:status', authMiddleware, adminOnly, meetingsController.getAllMeetingsByStatus);
router.get('/:id', authMiddleware, meetingsController.getMeetingById);
router.get('/attendance/pending', authMiddleware, adminOrHeadOnly, meetingsController.getMeetingsForAttendance);

// Update & Delete
router.put('/:id', authMiddleware, adminOrHeadOnly, meetingsController.updateMeeting); 
router.delete('/:id', authMiddleware, adminOrHeadOnly, meetingsController.deleteMeeting);

// Route to get full details of a specific meeting
router.get('/:meetingId', authMiddleware, meetingsController.getMeetingDetails);

module.exports = router;