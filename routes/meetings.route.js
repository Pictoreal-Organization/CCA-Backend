const express = require('express');
const router = express.Router();
const meetingsController = require('../controllers/meetings.controller');
const { authMiddleware, checkPermission, adminOrHeadOnly, adminOnly } = require('../middlewares/auth.middleware');
const PERMISSIONS = require('../config/permissions');

router.get('/core/entire', authMiddleware, adminOrHeadOnly, meetingsController.getEntireCore);
router.get('/core/be', authMiddleware, adminOrHeadOnly, meetingsController.getBECore);
router.get('/core/te', authMiddleware, adminOrHeadOnly, meetingsController.getTECore);

// Control check
router.get('/:id/has-control', authMiddleware, meetingsController.getHasControl);

// Create
router.post('/create', authMiddleware, checkPermission(PERMISSIONS.MEETING.CREATE), meetingsController.createMeeting);

// Read
router.get('/', authMiddleware, meetingsController.getAllMeetings);
router.get('/status/:status', authMiddleware, meetingsController.getMeetingsByStatus);
router.get('/all/status/:status', authMiddleware, adminOnly, meetingsController.getAllMeetingsByStatus);
router.get('/:id', authMiddleware, meetingsController.getMeetingById);
router.get('/attendance/pending', authMiddleware, adminOrHeadOnly, meetingsController.getMeetingsForAttendance);

// Update & Delete
router.put('/:id', authMiddleware, checkPermission(PERMISSIONS.MEETING.UPDATE), meetingsController.updateMeeting); 
router.delete('/:id', authMiddleware, checkPermission(PERMISSIONS.MEETING.DELETE), meetingsController.deleteMeeting);

module.exports = router;