// routes/attendance.js
const express = require('express');
const router = express.Router();
const Attendance = require('../models/attendanceSchema');
const Meeting = require('../models/meetingSchema');

// POST attendance after meeting ends
router.post('/:meetingId', async (req, res) => {
  const { meetingId } = req.params;
  const { attendanceList } = req.body; // Array: [{ memberId, status }, ...]

  try {
    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    const meetingEndTime = new Date(meeting.dateTime.getTime() + meeting.duration * 60000);
    if (new Date() < meetingEndTime) {
      return res.status(400).json({ error: 'Meeting has not ended yet' });
    }

    const bulkRecords = attendanceList.map(entry => ({
      meeting: meetingId,
      member: entry.memberId,
      status: entry.status
    }));

    await Attendance.insertMany(bulkRecords);
    res.status(201).json({ message: 'Attendance recorded successfully' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to submit attendance' });
  }
});

module.exports = router;
