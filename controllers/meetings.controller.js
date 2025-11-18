const { Meeting, User, Team } = require('../models/index');
// const emailService = require('../services/email.service');

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
    // if (recipientUsers.length > 0) {
    //   emailService.sendMeetingCreationEmail(meeting, organizer, recipientUsers);
    // }
    
    res.status(201).json({ msg: "Meeting created successfully", meeting });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAllMeetings = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const userRole = req.user.role; // Admin / Head / Member

    // Fetch all meetings first
    const meetings = await Meeting.find()
      .populate("team")
      .populate("invitedMembers")
      .populate("organizer")
      .sort({ dateTime: 1 });

    const visibleMeetings = meetings.filter(meeting => {

      // 1. PUBLIC MEETINGS visible to all
      if (meeting.isPrivate === false) return true;

      // 2. ADMIN can see ALL private meetings
      if (userRole === "Admin") return true;

      // 3. HEAD can see ONLY private meetings they created
      if (userRole === "Head") {
        return meeting.organizer._id.toString() === userId;
      }

      // 4. MEMBER can see private meetings they are invited to
      if (userRole === "Member") {
        const isInvited = meeting.invitedMembers.some(
          u => u._id.toString() === userId
        );
        if (isInvited) return true;

        // also team  meetings
        if (meeting.team) {
          const isMember = meeting.team.members?.some(
            m => m.toString() === userId
          );
          if (isMember) return true;
        }
      }

      return false; // not visible
    });

    res.status(200).json(visibleMeetings);

  } catch (err) {
    res.status(500).json({ error: "Failed to fetch meetings" });
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
    const userRole = req.user.role;

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

      const visibleMeetings = meetings.filter(meeting => {
        const userIdStr = req.user._id.toString();
        const userRole = req.user.role; // 'Admin', 'Head', 'Member'

        const hasTeam = meeting.team && meeting.team.length > 0;
        const isPrivate = meeting.isPrivate;

        // Public general meeting → everyone sees
        if (!isPrivate && !hasTeam) return true;

        //  Public team-specific meeting → team members + all heads + admin
        if (!isPrivate && hasTeam) {
          if (userRole === 'Admin') return true;

          // 1. All heads can see
          if (userRole === 'Head') return true;

          // 2. Any member of the team
          const isTeamMember = meeting.team.some(teamObj =>
            teamObj.members?.some(m => m._id.toString() === userIdStr)
          );

          return isTeamMember;
        }

        //  Private general meeting → invited members + all heads + Admin
        if (isPrivate && !hasTeam) {
          if (userRole === 'Admin') return true;

          const isInvited = meeting.invitedMembers?.some(u => u._id.toString() === userIdStr);
          const isHead = userRole === 'Head';
          return isInvited || isHead;
        }

        // Private team meeting → invited members + respective team heads + Admin
        if (isPrivate && hasTeam) {
          if (userRole === 'Admin') return true;

          const isInvited = meeting.invitedMembers?.some(u => u._id.toString() === userIdStr);
          const isTeamHead = meeting.team.some(teamObj =>
            teamObj.heads?.some(h => h._id.toString() === userIdStr)
          );

          return isInvited || isTeamHead;
        }

        return false;
      });

    res.status(200).json(visibleMeetings);

  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: 'Failed to fetch meetings' });
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
      // if (recipientUsers.length > 0) {
      //   emailService.sendMeetingCancellationEmail(meeting, organizer, recipientUsers);
      // }
    } catch (emailErr) {
      console.warn("Failed to send cancellation email:", emailErr.message);
    }

    res.status(200).json({ msg: "Meeting deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
