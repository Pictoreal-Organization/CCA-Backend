const express = require('express');
const router = express.Router();
const meetingsController = require('../controllers/meetings.controller');
const { authMiddleware, adminOrHeadOnly, adminOnly } = require('../middlewares/auth.middleware');

router.get('/core/entire', authMiddleware, adminOrHeadOnly, meetingsController.getEntireCore);
router.get('/core/be', authMiddleware, adminOrHeadOnly, meetingsController.getBECore);
router.get('/core/te', authMiddleware, adminOrHeadOnly, meetingsController.getTECore);

// Control check
router.get('/:id/has-control', authMiddleware, meetingsController.getHasControl);

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

module.exports = router;