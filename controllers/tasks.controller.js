const { Task, Team, User } = require('../models/index');
const mongoose = require('mongoose');

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

// exports.getTasksByUser = async (req, res) => {
//   try {
//     const userId = req.params.userId; // <-- use user ID here
//     if (!userId) return res.status(400).json({ error: 'userId is required' });

//     const tasks = await Task.find({
//       'subtasks.assignedTo': userId
//     }).populate('team').populate('subtasks.assignedTo');

//     res.status(200).json(tasks);
//   } catch (err) {
//     res.status(500).json({ error: 'Failed to fetch user tasks' });
//   }
// };

exports.getTasksByUser = async (req, res) => {
  try {
    const userId = req.params.userId;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Convert the string userId to a MongoDB ObjectId for accurate matching
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const tasks = await Task.aggregate([
      // Stage 1: Find tasks where the user is assigned to at least one subtask
      {
        $match: {
          'subtasks.assignedTo': userObjectId
        }
      },
      // Stage 2: Overwrite the 'subtasks' array with a filtered version
      {
        $addFields: {
          subtasks: {
            $filter: {
              input: '$subtasks', // The array to filter
              as: 'subtask',      // A variable for each element in the array
              cond: { $in: [userObjectId, '$$subtask.assignedTo'] } // The condition to meet
            }
          }
        }
      }
    ]);

    // After aggregation, you can manually populate the fields
    // Mongoose can populate plain objects returned from an aggregation
    await Task.populate(tasks, { path: 'team' });
    await Task.populate(tasks, { path: 'subtasks.assignedTo' });

    res.status(200).json(tasks);
  } catch (err) {
    console.error(err); // It's good practice to log the actual error
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

exports.updateSubtask = async (req, res) => {
  try {
    const { taskId, subtaskId } = req.params;
    const { status, description } = req.body; // We'll always expect status and sometimes description
    const { id, role } = req.user; // Get user's ID and role from authMiddleware

    // Find the task to check the subtask's current state
    const task = await Task.findOne({ _id: taskId, 'subtasks._id': subtaskId });
    if (!task) {
      return res.status(404).json({ error: 'Task or subtask not found' });
    }

    const subtask = task.subtasks.id(subtaskId);
    const isAssigned = subtask.assignedTo.some(assignedUserId => assignedUserId.equals(id));

    // --- NEW VALIDATION LOGIC ---
    // Rule 1: Member must provide description when completing a task.
    if (role === 'Member' && status === 'Completed' && (!description || description.trim() === '')) {
      return res.status(400).json({ error: 'A completion description is required.' });
    }
    
    // Rule 2: Head must provide description (changes) when reverting a completed task.
    if (role === 'Head' && status === 'Pending' && subtask.status === 'Completed' && (!description || description.trim() === '')) {
      return res.status(400).json({ error: 'Please provide the required changes to the member.' });
    }
    
    // Security check: Only assigned members or heads can make changes.
    if (role === 'Member' && !isAssigned) {
      return res.status(403).json({ error: 'Forbidden: You are not assigned to this subtask.' });
    }
    
    // --- DATABASE UPDATE ---
    const fieldsToUpdate = {};
    if (status) fieldsToUpdate['subtasks.$.status'] = status;
    // Always update the description if it's provided.
    if (description !== undefined) fieldsToUpdate['subtasks.$.description'] = description;

    const updatedTask = await Task.findOneAndUpdate(
      { '_id': taskId, 'subtasks._id': subtaskId },
      { $set: fieldsToUpdate },
      { new: true }
    ).populate('team').populate('subtasks.assignedTo');

    res.status(200).json({ message: 'Subtask updated successfully', task: updatedTask });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update subtask' });
  }
};