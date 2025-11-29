const { Meeting, User, Team, Attendance } = require('../models/index');
const admin = require('../config/firebase'); 

// -------- CONTROL CHECK HELPER ----------
// const canUserControlMeeting = async (user, meeting) => {
//   if (!user || !meeting) return false;

//   const userId = user._id.toString();

//   if (user.role === "Admin") return true;

//   if (meeting.organizer?.toString() === userId) return true;

//   if (meeting.team && meeting.team.length > 0) {
//     const teams = await Team.find({ _id: { $in: meeting.team } });
//     for (const t of teams) {
//       if (t.heads.some(h => h.toString() === userId)) {
//         return true;
//       }
//     }
//   }

//   const organizer = await User.findById(meeting.organizer).populate("team");
//   if (!organizer?.team) return false;
//   const organizerTeam = organizer.team;
//   return organizerTeam.heads.some(
//     headId => headId.toString() === user._id.toString()
//   );

//   return false;
// };

// -------- CONTROL CHECK HELPER ----------
const canUserControlMeeting = async (user, meeting) => {
  if (!user || !meeting) return false;

  const userId = user._id.toString();

  // 1. Admin Check
  if (user.role === "Admin") return true;

  // 2. Organizer Check (Self)
  const organizerId = meeting.organizer?._id 
      ? meeting.organizer._id.toString() 
      : meeting.organizer?.toString();
      
  if (organizerId === userId) return true;

  // 3. Head Logic (Strict Team Ownership)
  if (user.role === "Head") {
    try {
      // A. Fetch the Organizer's User Profile to find their teams
      const organizerUser = await User.findById(organizerId);

      if (organizerUser && organizerUser.team && organizerUser.team.length > 0) {
        
        // B. Check if YOU are a Head of ANY team the Organizer belongs to.
        // Logic: Find a team where:
        // 1. The ID matches one of the Organizer's teams.
        // 2. YOUR ID is inside the 'heads' array of that team.
        const isHeadOfOrganizerTeam = await Team.findOne({
          _id: { $in: organizerUser.team }, // Teams the organizer is in
          heads: userId                     // Check if YOU are the head
        });

        if (isHeadOfOrganizerTeam) {
          // console.log(`✅ Access Granted: You are a Head of the Organizer's Team.`);
          return true;
        }
      }
    } catch (error) {
      console.error("Error in Team Head check:", error);
    }
  }

  // Access Denied
  return false;
};

// Helper to send notifications
const sendFcmNotification = async (users, title, body, data) => {
  try {
    let allTokens = [];
    users.forEach(user => {
      if (user.fcmTokens && Array.isArray(user.fcmTokens)) {
        allTokens.push(...user.fcmTokens);
      }
    });
    
    // Remove duplicates and nulls
    allTokens = [...new Set(allTokens.filter(t => t))];
    
    if (allTokens.length === 0) return;

    const message = {
      data: {
        ...data,
        title: title,
        body: body
      },
      tokens: allTokens,
    };

    await admin.messaging().sendEachForMulticast(message);
    console.log(`🔔 Sent Data Notification for: ${title}`);
  } catch (error) {
    console.error("Error in sendFcmNotification:", error);
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

// ✅ HELPER FUNCTION - Internal use only (renamed for clarity)
const fetchQuickSelectMemberIds = async (option, userId) => {
  try {
    const currentUser = await User.findById(userId);
    
    // Check if user is BE Core head
    const beTeam = await Team.findOne({ name: /BE Core/i });
    // const isBEHead = currentUser.role === 'Head' && 
    //                  beTeam && 
    //                  beTeam.heads.some(h => h.toString() === userId.toString());
    const isBEHead = 
      currentUser.role?.toLowerCase() === 'head' &&
      beTeam &&
      beTeam.heads.some(h => h.equals(userId));


    let memberIds = [];

    switch(option) {
      case 'core':
        // Get all heads
        const allHeads = await User.find({ role: 'Head' });
        memberIds = allHeads.map(h => h._id.toString());
        break;

      case 'be-core':
        // Only if user is BE head - get BE Core team members (not heads)
        if (isBEHead && beTeam) {
          memberIds = beTeam.members.map(m => m.toString());
        }
        break;

      case 'te-core':
        // Only if user is NOT BE head - get all heads except BE Core heads
        if (!isBEHead) {
          const allHeads = await User.find({ role: 'Head' });
          const beHeadIds = beTeam ? beTeam.heads.map(h => h.toString()) : [];
          memberIds = allHeads
            .map(h => h._id.toString())
            .filter(id => !beHeadIds.includes(id));
        }
        break;

      default:
        memberIds = [];
    }

    return memberIds;
  } catch (error) {
    console.error('Error in fetchQuickSelectMemberIds:', error);
    return [];
  }
};


exports.getHasControl = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) {
      return res.status(404).json({ error: "Meeting not found" });
    }

    const canControl = await canUserControlMeeting(req.user, meeting);
    console.log("CanControl ", canControl);
    return res.status(200).json({ canControl });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to check control access' });
  }
};



// ✅ ENDPOINT 1 - Get available options for current user
exports.getQuickSelectOptions = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const currentUser = await User.findById(userId);
    
    // Check if user is BE Core head
    const beTeam = await Team.findOne({ name: /BE Core/i });
    // const isBEHead = currentUser.role === 'Head' && 
    //                  beTeam && 
    //                  beTeam.heads.some(h => h.toString() === userId.toString());
    const isBEHead = 
      currentUser.role?.toLowerCase() === 'head' &&
      beTeam &&
      beTeam.heads.some(h => h.equals(userId));

    const options = [
      {
        id: 'core',
        label: 'Entire Core',
        description: 'Add all heads to the meeting',
        visible: true
      }
    ];

    if (isBEHead) {
      options.push({
        id: 'be-core',
        label: 'BE Core',
        description: 'Add all BE Core team members',
        visible: true
      });
    } else {
      options.push({
        id: 'te-core',
        label: 'TE Core',
        description: 'Add all heads except BE Core heads',
        visible: true
      });
    }

    res.status(200).json(options);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ ENDPOINT 2 - Get members for a selected option (calls the helper)
exports.getQuickSelectMembers = async (req, res) => {
  try {
    const { option } = req.params;
    const userId = req.user._id.toString();
    
    // Call the HELPER function to get member IDs
    const memberIds = await fetchQuickSelectMemberIds(option, userId);
    
    // Get full user details
    const members = await User.find({ '_id': { $in: memberIds } })
      .select('_id name email rollNo role');
    
    res.status(200).json(members);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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

    await sendFcmNotification(
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

    await sendFcmNotification(
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

    await sendFcmNotification(
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
      .populate("organizer")
      .sort({ dateTime: 1 });
    const result = await Promise.all(meetings.map(async (meeting) => {
      const canControl = await canUserControlMeeting(req.user, meeting);
      
      // Return the meeting data + the permission flag
      return {
        ...meeting.toObject(), // Converts Mongoose doc to standard JSON object
        canControl: canControl 
      };
    }));

    res.status(200).json(result);
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
    const meetings = await Meeting.find({ status }).populate("organizer").sort({ dateTime: 1 });
    const result = await Promise.all(meetings.map(async (meeting) => {
      const canControl = await canUserControlMeeting(req.user, meeting);
      
      // Return the meeting data + the permission flag
      return {
        ...meeting.toObject(), // Converts Mongoose doc to standard JSON object
        canControl: canControl 
      };
    }));

    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch meetings by status' });
  }
};

// --- 7. GET BY STATUS (Optimized with canControl) ---
exports.getMeetingsByStatus = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const currentUser = await User.findById(userId);
    const { status } = req.params;

    // 1. Validation
    if (!['scheduled', 'ongoing', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    // 2. Fetch Data
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

    // 3. Filter Visibility (Who can SEE it?) - Keeping your exact logic
    const visibleMeetings = meetings.filter(meeting => {
        if (meeting.organizer._id.toString() === userIdStr) return true;
        
        const hasTeam = meeting.team && meeting.team.length > 0; 
        const isPrivate = meeting.isPrivate;

        // Public & No Team -> Everyone sees
        if (!isPrivate && !meeting.team) return true;

        // Public & No Team -> Admin/Head sees (Redundant but keeping your logic safe)
        if (!meeting.team && (userRole === 'Admin' || userRole === 'Head')) return true;

        // Public & Has Team
        if (!isPrivate && meeting.team) {
          if (userRole === 'Admin' || userRole === 'Head') return true;
          // Members only see if they belong to the team
          if (meeting.team.members) {
             return meeting.team.members.some(m => m._id.toString() === userIdStr);
          }
          return false; 
        }

        // Private Meetings
        if (isPrivate) {
          if (userRole === 'Admin') return true;
          
          // Invited explicitly?
          const isInvited = meeting.invitedMembers?.some(u => u._id.toString() === userIdStr);
          
          // Is Team Head?
          const isHead = currentUser.role?.toLowerCase() === 'head';
          const isTeamHead = meeting.team?.heads?.some(h => h._id.toString() === userIdStr);
          
          return isInvited || (isHead && hasTeam && isTeamHead); 
        }
        
        return false;
    });

    // 4. ✅ Calculate Control (Who can EDIT it?)
    // We map over the 'visibleMeetings' and add the 'canControl' flag
    const resultsWithControl = await Promise.all(visibleMeetings.map(async (meeting) => {
        const canControl = await canUserControlMeeting(req.user, meeting);
        
        return {
            ...meeting.toObject(), // Convert Mongoose doc to plain JSON object
            canControl: canControl // Attach the permission flag
        };
    }));

    res.status(200).json(resultsWithControl);

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
    }).populate("organizer").sort({ dateTime: 1 });
    const result = await Promise.all(meetings.map(async (meeting) => {
      const canControl = await canUserControlMeeting(req.user, meeting);
      
      // Return the meeting data + the permission flag
      return {
        ...meeting.toObject(), // Converts Mongoose doc to standard JSON object
        canControl: canControl 
      };
    }));

    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getMeetingDetails = async (req, res) => {
    try {
        const { meetingId } = req.params;

        // 1. Fetch the Meeting details and populate invited members/organizer
        const meeting = await Meeting.findById(meetingId)
            .select('-__v') // Exclude the version key
            .populate('organizer', 'name username')
            .populate('invitedMembers', 'name rollNo year division email phone')
            .lean(); // Use .lean() for faster query results as we're adding extra data

        if (!meeting) {
            return res.status(404).json({ msg: "Meeting not found" });
        }

        // 2. Fetch the Attendance details and populate present/absent members
        const attendance = await Attendance.findOne({ meeting: meetingId })
            .select('presentMembers absentMembers') // Select only the arrays we need
            .populate('presentMembers', 'name rollNo year division email phone')
            .populate('absentMembers', 'name rollNo year division email phone')
            .lean();
        
        // 3. Combine the data
        const meetingDetails = {
            ...meeting,
            attendance: attendance || { presentMembers: [], absentMembers: [] }, // Attach attendance data (or empty arrays if attendance hasn't been taken yet)
            totalInvited: meeting.invitedMembers.length
        };

        res.status(200).json(meetingDetails);
    } catch (err) {
        console.error("Error fetching meeting details:", err);
        res.status(500).json({ error: "Failed to fetch meeting details." });
    }
};