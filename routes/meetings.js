const express = require('express');
const router = express.Router();
const { Meeting } = require('../models/schema');

// POST /schedulemeeting - Schedule a new meeting
router.post('/schedulemeeting', async (req, res) => {
  try {
    const meeting = new Meeting(req.body);
    await meeting.save();
    res.status(201).json(meeting);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /upcomingmeetings - Get all upcoming meetings
router.get('/upcomingmeetings', async (req, res) => {
  try {
    const now = new Date();
    const meetings = await Meeting.find({ dateTime: { $gte: now }, status: 'scheduled' }).sort('dateTime');
    res.json(meetings);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching meetings' });
  }
});

module.exports = router;
