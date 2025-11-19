const { Meeting, User, Team } = require('../models/index');
const admin = require('../config/firebase'); // ✅ Import Firebase

// --- 1. CREATE MEETING ---
exports.createMeeting = async (req, res) => {
  try {
    const {
      title, description, agenda, dateTime, duration,
      priority, location, onlineLink, team, tags, isPrivate, invitedMembers
    } = req.body;

    // Validation
    if (!title || !description || !dateTime) {
      return res.status(400).json({ msg: "Title, description, and dateTime are required" });
    }
    if ((!location || location.trim() === '') && (!onlineLink || onlineLink.trim() === '')) {
      return res.status(400).json({ msg: "Provide either a location or an online link" });
    }
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
      organizer: req.user._id,
      team: team || null,
      tags: tags || [],
      isPrivate: isPrivate || false,
      invitedMembers: invitedMembers || []
    });
    
    await meeting.save();

    // --- Notification Logic ---
    const recipientUsers = await getMeetingRecipients(meeting);
    const finalRecipients = recipientUsers.filter(u => u._id.toString() !== req.user._id.toString());

    if (finalRecipients.length > 0) {
      const dateStr = new Date(dateTime).toLocaleString('en-US', { 
        month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' 
      });

      await sendFcmNotification(
        finalRecipients,
        'New Meeting Scheduled 📅',
        `${title}\nOn: ${dateStr}`,
        { meetingId: meeting._id.toString(), type: 'MEETING_CREATED' }
      );
    }
    
    res.status(201).json({ msg: "Meeting created successfully", meeting });

  } catch (err) {
    console.error("Create meeting error:", err);
    res.status(500).json({ error: err.message });
  }
};

// --- 2. UPDATE MEETING (This was missing!) ---
exports.updateMeeting = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const meeting = await Meeting.findById(id);
    if (!meeting) return res.status(404).json({ msg: "Meeting not found" });

    // Authorization
    if (
      req.user.role !== 'Admin' &&
      req.user.role !== 'Head' &&
      meeting.organizer.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ msg: "Not authorized to edit this meeting" });
    }

    // Perform Update
    const updatedMeeting = await Meeting.findByIdAndUpdate(id, updateData, { new: true })
      .populate('team')
      .populate('invitedMembers');

    // --- Notification Logic ---
    const recipientUsers = await getMeetingRecipients(updatedMeeting);
    const finalRecipients = recipientUsers.filter(u => u._id.toString() !== req.user._id.toString());

    if (finalRecipients.length > 0) {
      const dateStr = new Date(updatedMeeting.dateTime).toLocaleString('en-US', { 
        month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' 
      });

      await sendFcmNotification(
        finalRecipients,
        'Meeting Updated ✏️',
        `Details for "${updatedMeeting.title}" have changed.\nNew time: ${dateStr}`,
        { meetingId: updatedMeeting._id.toString(), type: 'MEETING_UPDATED' }
      );
    }

    res.status(200).json({ msg: "Meeting updated successfully", meeting: updatedMeeting });

  } catch (err) {
    console.error("Update meeting error:", err);
    res.status(500).json({ error: err.message });
  }
};

// --- 3. DELETE MEETING ---
exports.deleteMeeting = async (req, res) => {
  try {
    const { id } = req.params;

    const meeting = await Meeting.findById(id);
    if (!meeting) return res.status(404).json({ msg: "Meeting not found" });

    // Authorization
    if (
      req.user.role !== 'Admin' &&
      req.user.role !== 'Head' &&
      meeting.organizer.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ msg: "Not authorized to delete this meeting" });
    }

    // --- Notification Logic (Before Delete) ---
    const recipientUsers = await getMeetingRecipients(meeting);
    const finalRecipients = recipientUsers.filter(u => u._id.toString() !== req.user._id.toString());

    if (finalRecipients.length > 0) {
      await sendFcmNotification(
        finalRecipients,
        'Meeting Cancelled ❌',
        `The meeting "${meeting.title}" has been cancelled.`,
        { meetingId: meeting._id.toString(), type: 'MEETING_CANCELLED' }
      );
    }

    await Meeting.findByIdAndDelete(id);

    res.status(200).json({ msg: "Meeting deleted successfully" });
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
        const hasTeam = meeting.team && meeting.team.length > 0; 
        const isPrivate = meeting.isPrivate;

        if (!isPrivate && !meeting.team) return true;

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

// ==========================================
//           HELPER FUNCTIONS
// ==========================================

// 1. Helper to gather recipients
const getMeetingRecipients = async (meeting) => {
  const recipientEmails = new Set();
  const recipientUsers = [];

  // Global Heads
  const heads = await User.find({ role: 'Head' });
  heads.forEach(head => {
    if (!recipientEmails.has(head.email)) {
      recipientEmails.add(head.email);
      recipientUsers.push(head);
    }
  });

  // Invited Members
  if (meeting.invitedMembers && meeting.invitedMembers.length > 0) {
    let invited = meeting.invitedMembers;
    if (invited.length > 0 && !invited[0].email) { 
       invited = await User.find({ '_id': { $in: meeting.invitedMembers } });
    }
    invited.forEach(user => {
      if (user && user.email && !recipientEmails.has(user.email)) {
        recipientEmails.add(user.email);
        recipientUsers.push(user);
      }
    });
  }

  // Team Members & Heads
  if (meeting.team) {
    let teamData = meeting.team;
    if (!teamData.members && !teamData.heads) {
        teamData = await Team.findById(meeting.team).populate('members').populate('heads');
    }
    if (teamData) {
      if (teamData.members) {
        teamData.members.forEach(user => {
          if (user && !recipientEmails.has(user.email)) {
            recipientEmails.add(user.email);
            recipientUsers.push(user);
          }
        });
      }
      if (teamData.heads) {
        teamData.heads.forEach(user => {
          if (user && !recipientEmails.has(user.email)) {
            recipientEmails.add(user.email);
            recipientUsers.push(user);
          }
        });
      }
    }
  }
  return recipientUsers;
};

// 2. Helper to send FCM
const sendFcmNotification = async (users, title, body, data) => {
  try {
    let allTokens = [];
    users.forEach(user => {
      if (user.fcmTokens && Array.isArray(user.fcmTokens)) {
        allTokens.push(...user.fcmTokens);
      }
    });
    allTokens = [...new Set(allTokens.filter(t => t))];
    if (allTokens.length === 0) return;

    const message = {
      notification: { title, body },
      data: data || {},
      tokens: allTokens,
    };

    await admin.messaging().sendEachForMulticast(message);
    console.log(`🔔 Sent notifications for: ${title}`);
  } catch (error) {
    console.error("Error in sendFcmNotification:", error);
  }
};