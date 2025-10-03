const { Task, Team, User } = require('../models/index');

exports.getAllTasks = async (req, res) => {
  try {
    const tasks = await Task.find()
      .populate('team')
      .populate('subtasks.assignedTo');
    res.status(200).json(tasks);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
};

exports.getTaskById = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('team')
      .populate('subtasks.assignedTo');

    if (!task) return res.status(404).json({ message: 'Task not found' });

    res.status(200).json(task);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch task' });
  }
};

exports.getTasksByTeam = async (req, res) => {
  try {
    const teamId = req.query.teamId || req.params.teamId;
    if (!teamId) return res.status(400).json({ error: 'teamId is required' });

    const tasks = await Task.find({ team: teamId })
      .populate('team')
      .populate('subtasks.assignedTo');

    res.status(200).json(tasks);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch team tasks' });
  }
};

exports.getTasksByUser = async (req, res) => {
  try {
    const userId = req.params.userId; // <-- use user ID here
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const tasks = await Task.find({
      'subtasks.assignedTo': userId
    }).populate('team').populate('subtasks.assignedTo');

    res.status(200).json(tasks);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user tasks' });
  }
};


exports.getTasksByStatus = async (req, res) => {
  try {
    const status = req.params.status;
    if (!['Pending', 'In Progress', 'Completed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    const tasks = await Task.find({ status })
      .populate('team')
      .populate('subtasks.assignedTo');

    res.status(200).json(tasks);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
};

exports.createTask = async (req, res) => {
  try {
    const { title, description, status, startDate, deadline, team, subtasks } = req.body;

    if (!title) return res.status(400).json({ error: 'Title is required' });

    // Optional: check if team exists
    if (team) {
      const existingTeam = await Team.findById(team);
      if (!existingTeam) return res.status(404).json({ error: 'Team not found' });
    }

    const task = new Task({
      title,
      description,
      status,
      startDate,
      deadline,
      team: team || null,
      subtasks
    });

    await task.save();

    const populatedTask = await Task.findById(task._id)
      .populate('team')
      .populate('subtasks.assignedTo');

    res.status(201).json({ msg: 'Task created successfully', task: populatedTask });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.updateTask = async (req, res) => {
  try {
    const task = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true })
      .populate('team')
      .populate('subtasks.assignedTo');

    if (!task) return res.status(404).json({ message: 'Task not found' });

    res.json(task);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.deleteTask = async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    res.json({ msg: 'Task deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
