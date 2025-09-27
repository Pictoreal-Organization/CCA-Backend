const { User, Member } = require('../models/index'); // adjust path to your models folder

exports.updateMemberProfile = async (req, res) => {
  try {
    const { userId } = req.params; // or from JWT
    const { name, rollNo, year, division, phone } = req.body;

    const user = await User.findById(userId).populate('memberRef');
    if (!user || user.role !== 'Member') return res.status(404).json({ msg: "Member not found" });

    const member = await Member.findById(user.memberRef);
    if (!member) return res.status(404).json({ msg: "Member profile not found" });

    // Update fields if provided
    if (name) member.name = name;
    if (rollNo) member.rollNo = rollNo;
    if (year) member.year = year;
    if (division) member.division = division;
    if (phone) member.phone = phone;

    await member.save();

    res.json({ msg: "Member profile updated", member });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
