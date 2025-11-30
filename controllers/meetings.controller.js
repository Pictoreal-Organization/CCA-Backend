const { Meeting, User, Team, Attendance } = require('../models/index');
const admin = require('../config/firebase'); 

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
// const getMeetingRecipients = async (meeting) => {
//   const recipientIds = new Set();
//   let hasSpecificTargets = false;

//   // 1. Add Team Members & Heads
//   if (meeting.team && meeting.team.length > 0) {
//     hasSpecificTargets = true;
//     const teams = await Team.find({ '_id': { $in: meeting.team } });
//     teams.forEach(t => {
//       t.members.forEach(m => recipientIds.add(m.toString()));
//       t.heads.forEach(h => recipientIds.add(h.toString()));
//     });
//   }

//   // 2. Add Invited Members
//   if (meeting.invitedMembers && meeting.invitedMembers.length > 0) {
//     hasSpecificTargets = true;
//     meeting.invitedMembers.forEach(m => recipientIds.add(m.toString()));
//   }

//   // 3. ✅ HANDLE GENERAL MEETINGS (Broadcast)
//   // If no specific team or invites were set, and it's NOT private, notify EVERYONE.
//   if (!hasSpecificTargets && !meeting.isPrivate) {
//     console.log("📢 General Meeting detected. Fetching ALL users for notification...");
//     const allUsers = await User.find({}, '_id'); // Fetch all user IDs
//     allUsers.forEach(u => recipientIds.add(u._id.toString()));
//   }

//   return Array.from(recipientIds);
// };

// Helper to get all recipients for a meeting
// const getMeetingRecipients = async (meeting) => {
//   const recipientIds = new Set();
//   const hasTeam = meeting.team && meeting.team.length > 0;
//   const isPrivate = meeting.isPrivate;

//   // Get all heads from all teams
//   const getAllHeads = async () => {
//     const teams = await Team.find({}).populate('heads', '_id');
//     const headIds = new Set();
//     teams.forEach(team => {
//       if (team.heads && team.heads.length > 0) {
//         team.heads.forEach(head => {
//           headIds.add(head._id.toString());
//         });
//       }
//     });
//     return Array.from(headIds);
//   };

//   // Case 1: meeting.team && !meeting.isPrivate
//   // Recipients: All heads + Only team members
//   if (hasTeam && !isPrivate) {
//     console.log("📋 Case 1: Team meeting (Public) - All heads + Team members");
    
//     // Add all heads
//     const allHeadIds = await getAllHeads();
//     allHeadIds.forEach(id => recipientIds.add(id));
    
//     // Add team members only
//     const teams = await Team.find({ '_id': { $in: meeting.team } });
//     teams.forEach(team => {
//       team.members.forEach(m => recipientIds.add(m.toString()));
//     });
//   }
  
//   // Case 2: meeting.team && meeting.isPrivate
//   // Recipients: Team heads + Invited members
//   else if (hasTeam && isPrivate) {
//     console.log("🔒 Case 2: Team meeting (Private) - Team heads + Invited members");
    
//     // Add team heads only
//     const teams = await Team.find({ '_id': { $in: meeting.team } });
//     teams.forEach(team => {
//       team.heads.forEach(h => recipientIds.add(h.toString()));
//     });
    
//     // Add invited members
//     if (meeting.invitedMembers && meeting.invitedMembers.length > 0) {
//       meeting.invitedMembers.forEach(m => recipientIds.add(m.toString()));
//     }
//   }
  
//   // Case 3: !meeting.team && meeting.isPrivate
//   // Recipients: Invited members + All heads
//   else if (!hasTeam && isPrivate) {
//     console.log("🔐 Case 3: No team (Private) - Invited members + All heads");
    
//     // Add invited members
//     if (meeting.invitedMembers && meeting.invitedMembers.length > 0) {
//       meeting.invitedMembers.forEach(m => recipientIds.add(m.toString()));
//     }
    
//     // Add all heads
//     const allHeadIds = await getAllHeads();
//     allHeadIds.forEach(id => recipientIds.add(id));
//   }
  
//   // Case 4: !meeting.team && !meeting.isPrivate
//   // Recipients: All members + All heads (Everyone)
//   else if (!hasTeam && !isPrivate) {
//     console.log("📢 Case 4: General meeting (Public) - All members + All heads");
    
//     // Add all users (both members and heads)
//     const allUsers = await User.find({}, '_id');
//     allUsers.forEach(u => recipientIds.add(u._id.toString()));
//   }

//   return Array.from(recipientIds);
// };

// Helper to get all recipients for a meeting
const getMeetingRecipients = async (meeting) => {
  const recipientIds = new Set();
  const hasTeam = meeting.team && meeting.team.length > 0;
  const isPrivate = meeting.isPrivate;

  console.log(`\n🔍 --- START DEBUG: Meeting "${meeting.title}" ---`);
  console.log(`ℹ️  Params: hasTeam=${hasTeam}, isPrivate=${isPrivate}`);

  // Debug Helper: Get all heads
  const getAllHeads = async () => {
    console.log("   🔄 [getAllHeads] Querying all teams...");
    
    // We fetch ONLY the heads to check their validity
    const teams = await Team.find({}).populate('heads', '_id name'); 
    const headIds = new Set();

    teams.forEach(team => {
      if (team.heads && team.heads.length > 0) {
        team.heads.forEach((head, index) => {
          // 🚨 CHECK FOR NULL
          if (head === null) {
            console.error(`   🚨 [CRITICAL ERROR] Team "${team.name || team._id}" has a NULL head at index ${index}!`);
            console.error(`      -> This means a User was deleted but their ID is still in this Team.`);
            console.error(`      -> This NULL value is likely crashing the loop.`);
          } else {
            // Valid Head
            // console.log(`      ✅ Found Head: ${head.name} (${head._id}) in ${team.name}`);
            headIds.add(head._id.toString());
          }
        });
      }
    });
    
    console.log(`   ✅ [getAllHeads] Successfully collected ${headIds.size} unique head IDs.`);
    return Array.from(headIds);
  };

  // Case 1: Team meeting (Public)
  if (hasTeam && !isPrivate) {
    console.log("   👉 Case 1 Logic Triggered");

    // 1. Try to get all heads
    try {
      const allHeadIds = await getAllHeads();
      allHeadIds.forEach(id => recipientIds.add(id));
    } catch (error) {
      console.error("   ❌ [CRITICAL] getAllHeads() CRASHED:", error);
    }

    // 2. Get Team Members
    console.log(`   🔄 Fetching specific teams: ${meeting.team}`);
    const teams = await Team.find({ '_id': { $in: meeting.team } });
    
    teams.forEach(t => {
      console.log(`      -> Team Found: "${t.name}"`);
      console.log(`      -> Member Count: ${t.members.length}`);
      
      t.members.forEach(m => recipientIds.add(m.toString()));
    });
  }
  
  // Case 2: Team meeting (Private)
  else if (hasTeam && isPrivate) {
    console.log("   👉 Case 2 Logic Triggered");
    const teams = await Team.find({ '_id': { $in: meeting.team } });
    teams.forEach(t => {
      t.heads.forEach(h => recipientIds.add(h.toString()));
    });
    if (meeting.invitedMembers) meeting.invitedMembers.forEach(m => recipientIds.add(m.toString()));
  }
  
  // Case 3: No team (Private)
  else if (!hasTeam && isPrivate) {
    console.log("   👉 Case 3 Logic Triggered");
    if (meeting.invitedMembers) meeting.invitedMembers.forEach(m => recipientIds.add(m.toString()));
    const allHeadIds = await getAllHeads();
    allHeadIds.forEach(id => recipientIds.add(id));
  }
  
  // Case 4: General meeting (Public)
  else if (!hasTeam && !isPrivate) {
    console.log("   👉 Case 4 Logic Triggered");
    const allUsers = await User.find({}, '_id');
    allUsers.forEach(u => recipientIds.add(u._id.toString()));
  }

  const finalRecipients = Array.from(recipientIds);
  console.log(`🏁 END DEBUG: Total Recipients found: ${finalRecipients.length}`);
  console.log(`--------------------------------------------------------\n`);

  return finalRecipients;
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

exports.createMeeting = async (req, res) => {
  try {
    const meeting = new Meeting({ ...req.body, organizer: req.user._id });
    await meeting.save();

    // --- 🔔 NOTIFICATION LOGIC FIXED ---
    // 1. Get IDs
    const recipientIds = await getMeetingRecipients(meeting);
    
    // 2. Filter out self (Organizer)
    const targetIds = recipientIds.filter(id => id !== req.user._id.toString());

    // 3. ✅ FETCH USER OBJECTS (This was missing)
    const recipientUsers = await User.find({ _id: { $in: targetIds } });

    const dateStr = new Date(meeting.dateTime).toLocaleString('en-US', { 
        month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' 
    });

    // 4. Pass User Objects to helper
    await sendFcmNotification(
      recipientUsers, // Passed Objects, not IDs
      '📅 New Meeting Scheduled',
      `${meeting.title}\nOn: ${dateStr}`,
      { 
        type: 'MEETING_CREATED', 
        meetingId: meeting._id.toString() 
      }
    );

    res.status(201).json(meeting);
  } catch (err) {
    console.error("Create Meeting Error:", err);
    res.status(500).json({ error: err.message });
  }
};


exports.updateMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.findByIdAndUpdate(req.params.id, req.body, { new: true });
    
    // --- 🔔 NOTIFICATION LOGIC FIXED ---
    const recipientIds = await getMeetingRecipients(meeting);
    const targetIds = recipientIds.filter(id => id !== req.user._id.toString());

    // ✅ FETCH USER OBJECTS
    const recipientUsers = await User.find({ _id: { $in: targetIds } });

    const dateStr = new Date(meeting.dateTime).toLocaleString('en-US', { 
        month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' 
    });

    await sendFcmNotification(
      recipientUsers,
      '✏️ Meeting Updated',
      `Details for "${meeting.title}" have changed.\nNew Info: ${dateStr}`,
      { 
        type: 'MEETING_UPDATED', 
        meetingId: meeting._id.toString() 
      }
    );

    res.json(meeting);
  } catch (err) {
    console.error("Update Meeting Error:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.deleteMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) return res.status(404).json({ msg: "Not Found" });

    // --- 🔔 NOTIFICATION LOGIC FIXED ---
    const recipientIds = await getMeetingRecipients(meeting);
    const targetIds = recipientIds.filter(id => id !== req.user._id.toString());

    // ✅ FETCH USER OBJECTS
    const recipientUsers = await User.find({ _id: { $in: targetIds } });

    await sendFcmNotification(
      recipientUsers,
      '❌ Meeting Cancelled',
      `"${meeting.title}" has been cancelled.`,
      { 
        type: 'MEETING_CANCELLED' 
      }
    );

    await Meeting.findByIdAndDelete(req.params.id);
    res.json({ msg: "Deleted" });
  } catch (err) {
    console.error("Delete Meeting Error:", err);
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

exports.getMeetingsByStatus = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const currentUser = await User.findById(userId);
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
        // Creator always sees their meeting
        if (meeting.organizer._id.toString() === userIdStr) return true;
        
        const hasTeam = meeting.team && meeting.team.length > 0; 
        const isPrivate = meeting.isPrivate;

        // Public & No Team -> Everyone sees
        if (!isPrivate && !hasTeam) return true;

        // Public & Has Team
        if (!isPrivate && hasTeam) {
          if (userRole === 'Admin' || userRole === 'Head') return true;
          
          // ✅ FIX: Check if member belongs to ANY of the meeting's teams
          const isMemberOfAnyTeam = meeting.team.some(team => 
            team.members && team.members.some(m => m._id.toString() === userIdStr)
          );
          
          return isMemberOfAnyTeam;
        }

        // Private Meetings
        if (isPrivate) {
          if (userRole === 'Admin') return true;
          
          // Invited explicitly?
          const isInvited = meeting.invitedMembers?.some(u => u._id.toString() === userIdStr);
          
          // Is Team Head of any of the meeting's teams?
          const isTeamHead = hasTeam && meeting.team.some(team =>
            team.heads && team.heads.some(h => h._id.toString() === userIdStr)
          );
          
          return isInvited || isTeamHead; 
        }
        
        return false;
    });

    // 4. Calculate Control
    const resultsWithControl = await Promise.all(visibleMeetings.map(async (meeting) => {
        const canControl = await canUserControlMeeting(req.user, meeting);
        
        return {
            ...meeting.toObject(),
            canControl: canControl
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

// ✅ NEW CONTROLLER 1: Get All Heads (Entire Core)
exports.getEntireCore = async (req, res) => {
  try {
    // Get all teams and populate their heads
    const teams = await Team.find({}).populate('heads', '_id name email rollNo');
    
    // Extract all head IDs (use Set to avoid duplicates)
    const headIdsSet = new Set();
    teams.forEach(team => {
      if (team.heads && team.heads.length > 0) {
        team.heads.forEach(head => {
          headIdsSet.add(head._id.toString());
        });
      }
    });
    
    // Get full user details for all heads
    const headIds = Array.from(headIdsSet);
    const allHeads = await User.find({ '_id': { $in: headIds } })
      .select('_id name email rollNo role year division');
    
    res.status(200).json(allHeads);
  } catch (err) {
    console.error('Error in getEntireCore:', err);
    res.status(500).json({ error: 'Failed to fetch core members' });
  }
};

// ✅ NEW CONTROLLER 2: Get BE Core Heads Only
exports.getBECore = async (req, res) => {
  try {
    // Find the BE Core team (case-insensitive)
    const beTeam = await Team.findOne({ name: /^BE Core$/i })
      .populate('heads', '_id name email rollNo');
    
    if (!beTeam) {
      return res.status(404).json({ error: 'BE Core team not found' });
    }
    
    // Get full details of BE Core heads
    const beHeadIds = beTeam.heads.map(head => head._id);
    const beHeads = await User.find({ '_id': { $in: beHeadIds } })
      .select('_id name email rollNo role year division');
    
    res.status(200).json(beHeads);
  } catch (err) {
    console.error('Error in getBECore:', err);
    res.status(500).json({ error: 'Failed to fetch BE Core heads' });
  }
};

// ✅ NEW CONTROLLER 3: Get TE Core Heads (All teams except BE Core)
exports.getTECore = async (req, res) => {
  try {
    // Get all teams except BE Core
    const teams = await Team.find({ name: { $not: /^BE Core$/i } })
      .populate('heads', '_id name email rollNo');
    
    // Extract all head IDs (use Set to avoid duplicates)
    const headIdsSet = new Set();
    teams.forEach(team => {
      if (team.heads && team.heads.length > 0) {
        team.heads.forEach(head => {
          headIdsSet.add(head._id.toString());
        });
      }
    });
    
    // Get full user details for TE Core heads
    const headIds = Array.from(headIdsSet);
    const teHeads = await User.find({ '_id': { $in: headIds } })
      .select('_id name email rollNo role year division');
    
    res.status(200).json(teHeads);
  } catch (err) {
    console.error('Error in getTECore:', err);
    res.status(500).json({ error: 'Failed to fetch TE Core heads' });
  }
};