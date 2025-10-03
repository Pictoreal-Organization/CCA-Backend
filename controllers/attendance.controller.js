const {Attendance, Meeting, Team, User } = require('../models/index');

const canMarkAttendance = async (user, meeting) => {
  if (!user) return false;

  if (user.role === 'Admin') return true;

  if (user.role === 'Head') {
    if (!meeting.team) return true;
    const team = await Team.findById(meeting.team);
    if (!team) return false;

    return team.heads.some(headId => headId.equals(user._id));
  }

  return false;
};

// ✅ Mark or update attendance
exports.markAttendance = async (req, res) => {
  try {
    const { meetingId, memberId, status } = req.body;

    if (!meetingId || !memberId || !status) {
      return res.status(400).json({ msg: "meetingId, memberId, and status are required" });
    }

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) return res.status(404).json({ msg: "Meeting not found" });

    const member = await User.findById(memberId);
    if (!member) return res.status(404).json({ msg: "Member not found" });

    const authorized = await canMarkAttendance(req.user, meeting);
    if (!authorized) return res.status(403).json({ msg: "Not authorized to mark attendance" });

    // Check if attendance already exists
    let attendance = await Attendance.findOne({ meeting: meetingId, member: memberId });

    if (attendance) {
      attendance.status = status; // update
      await attendance.save();
    } else {
      attendance = new Attendance({
        status,
        member: memberId,
        meeting: meetingId
      });
      await attendance.save();
    }

    res.status(200).json({ msg: "Attendance marked successfully", attendance });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET all users with attendance status for a meeting
exports.getAttendanceForMeeting = async (req, res) => {
  try {
    const { meetingId } = req.params;

    const users = await User.find().sort({ name: 1 }); // or { rollNo: 1 }
    const attendanceRecords = await Attendance.find({ meeting: meetingId });

    const attendanceMap = {};
    attendanceRecords.forEach(record => {
      attendanceMap[record.member.toString()] = record.status;
    });

    const result = users.map(user => ({
      member: {
        _id: user._id,
        name: user.name,
        rollNo: user.rollNo,
        email: user.email,
      },
      status: attendanceMap[user._id.toString()] || "absent",
    }));

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

