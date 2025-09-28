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
      teamId
    } = req.body;

    if (!title || !description || !dateTime || !location || !teamId) {
      return res.status(400).json({ msg: "Title, description, dateTime, location, and teamId are required" });
    }

    const meeting = new Meeting({
      title,
      description,
      agenda,
      dateTime,
      duration,
      priority,
      location,
      onlineLink,
      organizer: req.user._id, // automatically the head or admin creating it
      team: teamId
    });

    await meeting.save();

    res.status(201).json({ msg: "Meeting created successfully", meeting });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAllMeetings = async (req, res) => {
  try {
    const meetings = await Meeting.find();
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

exports.getOngoingMeetings = async (req, res) => {
  try {
    const now = new Date();

    const meetings = await Meeting.find({
      dateTime: { $lte: now },
      $expr: { $gte: [{ $add: ["$dateTime", { $multiply: ["$duration", 60000] }] }, now] }, // convert duration to ms
      status: 'scheduled'
    }).sort({ dateTime: 1 });

    res.status(200).json(meetings);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch ongoing meetings' });
  }
};

exports.getPastMeetings = async (req, res) => {
  try {
    const now = new Date();
    const meetings = await Meeting.find({ dateTime: { $lt: now } })
      .sort({ dateTime: -1 });
    res.status(200).json(meetings);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch past meetings' });
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