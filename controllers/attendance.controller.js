const { Attendance, Meeting, Team, User } = require('../models/index');

const canMarkAttendance = async (user, meeting) => {
  if (!user) return false;

  const userId = user._id.toString();

  if (user.role === "Admin") return true;

  if (meeting.organizer && meeting.organizer.toString() === userId) return true;

  if (user.role !== "Head") return false;

  if (meeting.team && meeting.team.length > 0) {
    const teams = await Team.find({ _id: { $in: meeting.team } });
    const isHeadOfMeetingTeam = teams.some(team =>
      team.heads.some(hid => hid.toString() === userId)
    );
    if (isHeadOfMeetingTeam) return true;
  }

  const organizer = await User.findById(meeting.organizer).populate("team");
  if (!organizer || !organizer.team) return false;
  const organizerTeam = organizer.team;
  const isHeadOfOrganizerTeam = organizerTeam.heads.some(
    hid => hid.toString() === userId
  );

  return isHeadOfOrganizerTeam;
};

exports.markAttendance = async (req, res) => {
  try {
    const { meetingId, presentMemberIds } = req.body;

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) return res.status(404).json({ msg: "Meeting not found" });

    // Authorization
    const authorized = await canMarkAttendance(req.user, meeting);
    if (!authorized) return res.status(403).json({ msg: "Not authorized to mark attendance" });

    let absentMemberIds = [];

    if (meeting.team) {
      const team = await Team.findById(meeting.team);
      if (team && team.members && team.members.length > 0) {
        absentMemberIds = team.members
          .filter(memberId => !presentMemberIds.includes(memberId.toString()));
      }
    }

    // If no team, absentMemberIds will remain empty
    const updatedAttendance = await Attendance.findOneAndUpdate(
      { meeting: meetingId },
      {
        $set: {
          presentMembers: presentMemberIds,
          absentMembers: absentMemberIds,
        }
      },
      { new: true, upsert: true }
    );

    res.status(200).json({ msg: "Attendance has been successfully updated.", attendance: updatedAttendance });

  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error while updating attendance." });
  }
};


exports.getAttendanceForMeeting = async (req, res) => {
  try {
    const { meetingId } = req.params;

    // Find the single attendance document for the meeting
    const attendanceDoc = await Attendance.findOne({ meeting: meetingId });

    // Find the meeting
    const meeting = await Meeting.findById(meetingId);
    if (!meeting) return res.json([]); // No meeting, return empty list

    let users = [];

     if (meeting.isPrivate) {
      if (meeting.invitedMembers && meeting.invitedMembers.length > 0) {
        users = await User.find({
          _id: { $in: meeting.invitedMembers }
        }).sort({ name: 1 });
      } else {
        // No invited members - return empty list
        return res.json([]);
      }
    }

    else if (meeting.team) {
      const team = await Team.findById(meeting.team);
      if (team && team.members && team.members.length > 0) {
        // Team exists with members
        users = await User.find({ '_id': { $in: team.members } }).sort({ name: 1 });
      } else {
        // Team empty or missing, fallback to all users
        users = await User.find({}).sort({ name: 1 });
      }
    } else {
      // No team assigned -> fallback to all users
      users = await User.find({}).sort({ name: 1 });
    }

    // Map to frontend format
    const result = users.map(user => {
      let status = "absent"; // Default to absent
      if (attendanceDoc) {
        if (attendanceDoc.presentMembers.some(id => id.equals(user._id))) {
          status = "present";
        }
      }
      return {
        member: {
          _id: user._id,
          name: user.name,
          rollNo: user.rollNo,
          email: user.email,
          year: user.year,
          division: user.division,
          avatar: user.avatar,
        },
        status: status,
      };
    });

    res.json(result);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch attendance list" });
  }
};



// ✅ Get attendance for a member (all their meetings)
exports.getAttendanceForMember = async (req, res) => {
  try {
    const { memberId } = req.params;
    const attendance = await Attendance.find({ member: memberId })
      .populate('meeting', 'title dateTime location');

    res.status(200).json(attendance);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ Delete attendance (optional)
exports.deleteAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const attendance = await Attendance.findById(id);
    if (!attendance) return res.status(404).json({ msg: "Attendance not found" });

    const meeting = await Meeting.findById(attendance.meeting);
    const authorized = await canMarkAttendance(req.user, meeting);
    if (!authorized) return res.status(403).json({ msg: "Not authorized to delete attendance" });

    await Attendance.findByIdAndDelete(id);
    res.status(200).json({ msg: "Attendance deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

