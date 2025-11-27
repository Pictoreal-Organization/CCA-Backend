const { Meeting, User, Team } = require('../models/index');
const admin = require('../config/firebase'); 

// Helper to send notifications
const sendNotificationToUsers = async (userIds, title, body, data) => {
  try {
    // 1. Fetch users with their tokens
    const users = await User.find({ '_id': { $in: userIds } }).select('fcmTokens');
    
    // 2. Flatten all tokens into one array
    let tokens = [];
    users.forEach(u => {
      if (u.fcmTokens && u.fcmTokens.length > 0) {
        tokens.push(...u.fcmTokens);
      }
    });

    // 3. Send Multicast if tokens exist
    if (tokens.length > 0) {
      await admin.messaging().sendEachForMulticast({
        tokens: tokens,
        notification: { title, body },
        data: data || {} // Data payload for redirection
      });
      console.log(`🔔 Notification sent: ${title}`);
    }
  } catch (err) {
    console.error("❌ Notification Error:", err);
  }
};

// Helper to get all recipients for a meeting
const getMeetingRecipients = async (meeting) => {
  const recipientIds = new Set();

  // 1. Add Team Members & Heads
  if (meeting.team && meeting.team.length > 0) {
    const teams = await Team.find({ '_id': { $in: meeting.team } });
    teams.forEach(t => {
      t.members.forEach(m => recipientIds.add(m.toString()));
      t.heads.forEach(h => recipientIds.add(h.toString()));
    });
  }

  // 2. Add Invited Members
  if (meeting.invitedMembers && meeting.invitedMembers.length > 0) {
    meeting.invitedMembers.forEach(m => recipientIds.add(m.toString()));
  }

  // 3. Add Global Heads (if policy requires, optional)
  // const heads = await User.find({ role: 'Head' });
  // heads.forEach(h => recipientIds.add(h._id.toString()));

  return Array.from(recipientIds);
};

exports.createMeeting = async (req, res) => {
  try {
    const meeting = new Meeting({ ...req.body, organizer: req.user._id });
    await meeting.save();

    // --- 🔔 NOTIFICATION: Meeting Created ---
    const recipients = await getMeetingRecipients(meeting);
    const finalRecipients = recipients.filter(id => id !== req.user._id.toString()); // Exclude self

    const dateStr = new Date(meeting.dateTime).toLocaleString('en-US', { 
        month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' 
    });

    await sendNotificationToUsers(
      finalRecipients,
      '📅 New Meeting Scheduled',
      `${meeting.title}\nOn: ${dateStr}`,
      { 
        type: 'MEETING_CREATED', 
        meetingId: meeting._id.toString() 
      }
    );

    res.status(201).json(meeting);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.findByIdAndUpdate(req.params.id, req.body, { new: true });
    
    // --- 🔔 NOTIFICATION: Meeting Edited ---
    const recipients = await getMeetingRecipients(meeting);
    const finalRecipients = recipients.filter(id => id !== req.user._id.toString());

    const dateStr = new Date(meeting.dateTime).toLocaleString('en-US', { 
        month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' 
    });

    await sendNotificationToUsers(
      finalRecipients,
      '✏️ Meeting Updated',
      `Details for "${meeting.title}" have changed.\nNew Info: ${dateStr}`,
      { 
        type: 'MEETING_UPDATED', 
        meetingId: meeting._id.toString() 
      }
    );

    res.json(meeting);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) return res.status(404).json({ msg: "Not Found" });

    // --- 🔔 NOTIFICATION: Meeting Cancelled ---
    const recipients = await getMeetingRecipients(meeting);
    const finalRecipients = recipients.filter(id => id !== req.user._id.toString());

    await sendNotificationToUsers(
      finalRecipients,
      '❌ Meeting Cancelled',
      `"${meeting.title}" has been cancelled.`,
      { 
        type: 'MEETING_CANCELLED' // No redirection needed usually
      }
    );

    await Meeting.findByIdAndDelete(req.params.id);
    res.json({ msg: "Deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// --- 4. GET ALL MEETINGS ---
exports.getAllMeetings = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const userRole = req.user.role; 

    const meetings = await Meeting.find()
      .populate("team")
      .populate("invitedMembers")
      .populate("organizer")
      .sort({ dateTime: 1 });

    const visibleMeetings = meetings.filter(meeting => {
      // if (meeting.organizer._id.toString() === userId) return true;
      if (meeting.isPrivate === false) return true;
      if (userRole === "Admin") return true;
      if (userRole === "Head") return meeting.organizer._id.toString() === userId;
      if (userRole === "Member") {
        const isInvited = meeting.invitedMembers.some(u => u._id.toString() === userId);
        if (isInvited) return true;
        if (meeting.team) {
          const isMember = meeting.team.members?.some(m => m.toString() === userId);
          if (isMember) return true;
        }
      }
      return false;
    });

    res.status(200).json(visibleMeetings);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch meetings" });
  }
};

// --- 5. GET UPCOMING ---
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

// --- 6. GET BY STATUS (Simple) ---
exports.getAllMeetingsByStatus = async (req, res) => {
  try {
    const { status } = req.params;
    if (!['scheduled', 'ongoing', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }
    const meetings = await Meeting.find({ status }).sort({ dateTime: 1 });
    res.status(200).json(meetings);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch meetings by status' });
  }
};

// --- 7. GET BY STATUS (With Visibility) ---
exports.getMeetingsByStatus = async (req, res) => {
  try {
    const { status } = req.params;
    if (!['scheduled', 'ongoing', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    const meetings = await Meeting.find({ status })
      .populate({
        path: 'team',
        populate: [
          { path: 'members', select: '_id name email' },
          { path: 'heads', select: '_id name email' }
        ]
      })
      .populate('invitedMembers', '_id name email')
      .populate('organizer', '_id name email');

    const userIdStr = req.user._id.toString();
    const userRole = req.user.role;

    const visibleMeetings = meetings.filter(meeting => {
        // if (meeting.organizer._id.toString() === userId) return true;
        const hasTeam = meeting.team && meeting.team.length > 0; 
        const isPrivate = meeting.isPrivate;

        if (!isPrivate && !meeting.team) return true;

        if (!meeting.team && (userRole === 'Admin' || userRole === 'Head')) return true;

        if (!isPrivate && meeting.team) {
          if (userRole === 'Admin' || userRole === 'Head') return true;
          if (meeting.team.members) {
             return meeting.team.members.some(m => m._id.toString() === userIdStr);
          }
          return false; 
        }

        if (isPrivate) {
          if (userRole === 'Admin') return true;
          const isInvited = meeting.invitedMembers?.some(u => u._id.toString() === userIdStr);
          const isHead = userRole === 'Head'; 
          const isTeamHead = meeting.team?.heads?.some(h => h._id.toString() === userIdStr);
          return isInvited || (isHead && hasTeam && isTeamHead); 
        }
        return false;
    });

    res.status(200).json(visibleMeetings);
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: 'Failed to fetch meetings' });
  }
};

// --- 8. GET BY ID ---
exports.getMeetingById = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) return res.status(404).json({ message: "Meeting not found" });
    res.status(200).json(meeting);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch meeting' });
  }
};

// --- 9. GET FOR ATTENDANCE ---
exports.getMeetingsForAttendance = async (req, res) => {
  try {
    const now = new Date();
    const meetings = await Meeting.find({
      status: 'completed',
      dateTime: { $gte: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000) }
    });
    res.status(200).json(meetings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
