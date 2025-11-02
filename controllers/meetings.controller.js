const { Meeting, User, Team } = require('../models/index');
const emailService = require('../services/email.service');

exports.createMeeting = async (req, res) => {
  try {
    const {
      title, description, agenda, dateTime, duration,
      priority, location, onlineLink, team, tags, isPrivate, invitedMembers
    } = req.body;

    // --- Validation (This part is already perfect) ---
    if (!title || !description || !dateTime) {
      return res.status(400).json({ msg: "Title, description, and dateTime are required" });
    }
    if ((!location || location.trim() === '') && (!onlineLink || onlineLink.trim() === '')) {
      return res.status(400).json({ msg: "Provide either a location or an online link" });
    }
    if (location && onlineLink) {
      return res.status(400).json({ msg: "Provide only location or online link, not both" });
    }

    // --- Create and Save Meeting FIRST ---
    const meeting = new Meeting({
      title,
      description,
      agenda,
      dateTime,
      duration,
      priority,
      location: location || null,
      onlineLink: onlineLink || null,
      organizer: req.user._id,
      team: team || null,
      tags: tags || [],
      isPrivate: isPrivate || false,
      invitedMembers: invitedMembers || []
    });
    
    // ✅ FIX: Save the meeting to the database immediately.
    // This ensures the meeting exists before any emails are sent.
    await meeting.save();

    // --- Email Notification Logic (This part is already perfect) ---
    const recipientEmails = new Set();
    const recipientUsers = [];

    // 1. Get the organizer's full user object
    const organizer = await User.findById(req.user._id);

    // 2. Get all users with the 'Head' role
    const heads = await User.find({ role: 'Head' });
    heads.forEach(head => {
      if (!recipientEmails.has(head.email)) {
        recipientEmails.add(head.email);
        recipientUsers.push(head);
      }
    });

    // 3. Get specifically invited members
    if (invitedMembers && invitedMembers.length > 0) {
      const invited = await User.find({ '_id': { $in: invitedMembers } });
      invited.forEach(user => {
        if (!recipientEmails.has(user.email)) {
          recipientEmails.add(user.email);
          recipientUsers.push(user);
        }
      });
    }

    // 4. If it's a team meeting, get all team members and heads
    if (team) {
      const teamData = await Team.findById(team).populate('members').populate('heads');
      if (teamData) {
        teamData.members.forEach(user => {
          if (!recipientEmails.has(user.email)) {
            recipientEmails.add(user.email);
            recipientUsers.push(user);
          }
        });
        teamData.heads.forEach(user => {
          if (!recipientEmails.has(user.email)) {
            recipientEmails.add(user.email);
            recipientUsers.push(user);
          }
        });
      }
    }

    // 5. Send the email to the unique list of recipients
    if (recipientUsers.length > 0) {
      emailService.sendMeetingCreationEmail(meeting, organizer, recipientUsers);
    }
    
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
exports.getAllMeetingsByStatus = async (req, res) => {
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

exports.getMeetingsByStatus = async (req, res) => {
  try {
    const { status } = req.params;
    const userId = req.user._id.toString();
    const userRole = req.user.role; // 'Admin', 'Head', 'Member'

    if (!['scheduled', 'ongoing', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    const meetings = await Meeting.find({ status })
      .populate('team')
      .populate('invitedMembers')
      .populate('organizer');

    const visibleMeetings = meetings.filter(meeting => {
      // ✅ 1. Public meetings visible to everyone
      if (meeting.isPrivate === false) return true;

      // ✅ 2. Admins/Heads can view all private meetings
      if (userRole === 'Admin' || userRole === 'Head') return true;

      // ✅ 3. Invited members can see private meetings
      if (meeting.invitedMembers?.some(u => u._id.toString() === userId)) {
        return true;
      }

      // ✅ 4. Team members (heads/members) can see private team meetings
      if (meeting.team) {
        const isTeamHead = meeting.team.heads?.some(headId => headId.toString() === userId);
        const isTeamMember = meeting.team.members?.some(memberId => memberId.toString() === userId);
        if (isTeamHead || isTeamMember) return true;
      }

      // ❌ 5. Otherwise, not visible
      return false;
    });

    res.status(200).json(visibleMeetings);
  } catch (err) {
    console.error("Error fetching meetings:", err);
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

// Delete a meeting
exports.deleteMeeting = async (req, res) => {
  try {
    const { id } = req.params;

    // Find meeting by ID
    const meeting = await Meeting.findById(id);
    if (!meeting) {
      return res.status(404).json({ msg: "Meeting not found" });
    }

    // Optional: Allow only Admin, Head, or the organizer to delete
    if (
      req.user.role !== 'Admin' &&
      req.user.role !== 'Head' &&
      meeting.organizer.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ msg: "You are not authorized to delete this meeting" });
    }

    // Delete the meeting
    await Meeting.findByIdAndDelete(id);

    // (Optional) Send cancellation email
    try {
      const organizer = await User.findById(meeting.organizer);
      const recipientEmails = new Set();
      const recipientUsers = [];

      // Add invited members
      if (meeting.invitedMembers?.length > 0) {
        const invited = await User.find({ _id: { $in: meeting.invitedMembers } });
        invited.forEach(u => {
          if (!recipientEmails.has(u.email)) {
            recipientEmails.add(u.email);
            recipientUsers.push(u);
          }
        });
      }

      // Add team members if applicable
      if (meeting.team) {
        const teamData = await Team.findById(meeting.team).populate('members').populate('heads');
        if (teamData) {
          [...teamData.members, ...teamData.heads].forEach(u => {
            if (!recipientEmails.has(u.email)) {
              recipientEmails.add(u.email);
              recipientUsers.push(u);
            }
          });
        }
      }

      // Send cancellation email (if your email service supports it)
      if (recipientUsers.length > 0) {
        emailService.sendMeetingCancellationEmail(meeting, organizer, recipientUsers);
      }
    } catch (emailErr) {
      console.warn("Failed to send cancellation email:", emailErr.message);
    }

    res.status(200).json({ msg: "Meeting deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
