const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendance.controller');
const { authMiddleware, adminOnly } = require('../middlewares/auth.middleware');

router.post('/mark', authMiddleware, attendanceController.markAttendance);
router.get('/meeting/:meetingId', authMiddleware, attendanceController.getAttendanceForMeeting);
router.get('/member/:memberId', authMiddleware, attendanceController.getAttendanceForMember);
router.delete('/:id', authMiddleware, attendanceController.deleteAttendance);

module.exports = router;
