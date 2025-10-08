// controllers/meetings.controller.js
const { Meeting } = require('../models/index');

exports.createMeeting = async (req, res) => {
  try {
    const {
      title,
      description,
      agenda,
      dateTime,
      duration,
      priority,
      location,
      onlineLink,
      team
    } = req.body;

    if (!title || !description || !dateTime) {
      return res.status(400).json({ msg: "Title, description, and dateTime are required" });
    }

    // Online meeting
    if ((!location || location.trim() === '') && (!onlineLink || onlineLink.trim() === '')) {
      return res.status(400).json({ msg: "Provide either a location or an online link" });
    }

    // Prevent both being filled
    if (location && onlineLink) {
      return res.status(400).json({ msg: "Provide only location or online link, not both" });
    }

    const meeting = new Meeting({
      title,
      description,
      agenda,
      dateTime,
      duration,
      priority,
      location: location || null,
      onlineLink: onlineLink || null,
      organizer: req.user._id, // automatically the head or admin creating it
      team
    });

    await meeting.save();

    res.status(201).json({ msg: "Meeting created successfully", meeting });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAllMeetings = async (req, res) => {
  try {
    const meetings = await Meeting.find().sort({ dateTime: 1 });
    res.status(200).json(meetings);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch meetings' });
  }
};

exports.getUpcomingMeetings = async (req, res) => {
  try {
    const now = new Date();
    const meetings = await Meeting.find({ dateTime: { $gte: now }, status: 'scheduled' })
      .sort({ dateTime: 1 });
    res.status(200).json(meetings);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch upcoming meetings' });
  }
};

// Get meetings by status
exports.getMeetingsByStatus = async (req, res) => {
  try {
    const { status } = req.params; // pass status in URL
    if (!['scheduled', 'ongoing', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    const meetings = await Meeting.find({ status }).sort({ dateTime: 1 });
    res.status(200).json(meetings);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch meetings by status' });
  }
};

exports.getMeetingById = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found" });
    }
    res.status(200).json(meeting);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch meeting' });
  }
};

//  Get meetings eligible for attendance marking
exports.getMeetingsForAttendance = async (req, res) => {
  try {
    const now = new Date();

    // Completed meetings in last 2 days
    const meetings = await Meeting.find({
      status: 'completed',
      dateTime: { $gte: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000) } 
    });

    res.status(200).json(meetings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
