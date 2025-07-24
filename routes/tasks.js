const express = require('express');
const router = express.Router();
const { Task, Member } = require('../models/schema');

// POST /assigntask → Create a new task
router.post('/assigntask', async (req, res) => {
  try {
    const task = new Task(req.body);
    await task.save();
    res.status(201).json(task);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /tasks?memberId=xyz → Tasks relevant to a member
router.get('/tasks', async (req, res) => {
  try {
    const memberId = req.query.memberId;
    if (!memberId) return res.status(400).json({ error: 'memberId is required' });

    // Fetch member to get their team IDs
    const member = await Member.findById(memberId);
    if (!member) return res.status(404).json({ error: 'Member not found' });

    const teamIds = member.team; // Array of ObjectId

    const tasks = await Task.find({
      $or: [
        { 'subtasks.assignedMembers': memberId },
        { team: { $in: teamIds } }
      ]
    });

    // Filter subtasks for this member only
    const relevantTasks = tasks.map(task => {
      const filteredSubtasks = task.subtasks.filter(sub =>
        sub.assignedMembers.map(id => id.toString()).includes(memberId)
      );

      return {
        _id: task._id,
        description: task.description,
        deadline: task.deadline,
        startdate: task.startdate,
        team: task.team,
        status: task.status,
        subtasks: filteredSubtasks
      };
    });

    res.json(relevantTasks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching member tasks' });
  }
});

// GET /teamtask?teamId=xyz → Tasks of a specific team
router.get('/teamtask', async (req, res) => {
  try {
    const teamId = req.query.teamId;
    if (!teamId) return res.status(400).json({ error: 'teamId is required' });

    const tasks = await Task.find({ team: teamId }).populate('subtasks.assignedMembers');
    res.json(tasks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching team tasks' });
  }
});

module.exports = router;
