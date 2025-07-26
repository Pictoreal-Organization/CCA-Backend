const { Meeting } = require('../models/schema');

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