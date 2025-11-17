const { Task, Team, User } = require('../models/index');
const mongoose = require('mongoose');
const emailService = require('../services/email.service');

exports.getAllTasks = async (req, res) => {
  try {
    const tasks = await Task.find({ status: { $ne: 'Completed' } })
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
    const userId = req.params.userId;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);

    const tasks = await Task.aggregate([
      // ✅ ADD THIS STAGE: Only find tasks that are NOT completed.
      {
        $match: {
          status: { $ne: 'Completed' }
        }
      },
      // Stage 2: Find tasks where the user is assigned (no change here)
      {
        $match: {
          'subtasks.assignedTo': userObjectId
        }
      },
      // Stage 3: Filter the subtasks to show only the user's (no change here)
      {
        $addFields: {
          subtasks: {
            $filter: {
              input: '$subtasks',
              as: 'subtask',
              cond: { $in: [userObjectId, '$$subtask.assignedTo'] }
            }
          }
        }
      }
    ]);

    // Populate the results (no change here)
    await Task.populate(tasks, { path: 'team' });
    await Task.populate(tasks, { path: 'subtasks.assignedTo' });

    res.status(200).json(tasks);
  } catch (err) {
    console.error(err);
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

exports.getCompletedTasksByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const tasks = await Task.find({
      // Rule 1: The main task status must be 'Completed'
      status: 'Completed',
      // Rule 2: The user must be assigned to at least one subtask in this task
      'subtasks.assignedTo': userId,
    }).sort({ deadline: -1 }); // Sort by most recently completed

    if (!tasks) {
      return res.status(200).json([]); // Return empty array if no tasks found
    }

    res.status(200).json(tasks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch completed tasks' });
  }
};

exports.getCompletedTasksByTeam = async (req, res) => {
  try {
    const { teamId } = req.params;

    if (!teamId) {
      return res.status(400).json({ error: 'Team ID is required' });
    }

    const tasks = await Task.find({
      team: teamId,
      status: 'Completed'
    })
      .sort({ completedAt: -1 }) // Latest completed first
      .populate('team')
      .populate('subtasks.assignedTo');

    res.status(200).json(tasks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch completed tasks for team' });
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

    const assignedUserIds = req.body.subtasks.flatMap(s => s.assignedTo);
    const uniqueUserIds = [...new Set(assignedUserIds)]; // Remove duplicates
    const assignedUsers = await User.find({ '_id': { $in: uniqueUserIds } });
    
    if (assignedUsers.length > 0) {
      emailService.sendTaskCreationEmail(task, assignedUsers);
    }

    const populatedTask = await Task.findById(task._id)
      .populate('team')
      .populate('subtasks.assignedTo');

    res.status(201).json({ msg: 'Task created successfully', task: populatedTask });
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

// exports.updateTask = async (req, res) => {
//   try {
//     const updatedTask = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true });

//     if (!updatedTask) return res.status(404).json({ message: 'Task not found' });

//     // --- ✅ NEW EMAIL LOGIC ---
//     // If the task was just marked as completed, send the final email.
//     if (updatedTask.status === 'Completed') {
//       // Find all unique members involved in the task's subtasks.
//       const assignedUserIds = updatedTask.subtasks.flatMap(s => s.assignedTo);
//       const uniqueUserIds = [...new Set(assignedUserIds)];
//       const involvedMembers = await User.find({ '_id': { $in: uniqueUserIds } });
//       const headUser = await User.findById(req.user.id); // The head who completed the task.

//       if (involvedMembers.length > 0 && headUser) {
//         emailService.sendMainTaskCompletionEmail(updatedTask, headUser, involvedMembers);
//       }
//     }
//     // --- END EMAIL LOGIC ---

//     const populatedTask = await updatedTask.populate(['team', 'subtasks.assignedTo']);
//     res.json(populatedTask);
//   } catch (err) {
//     res.status(400).json({ error: err.message });
//   }
// };

// exports.updateSubtask = async (req, res) => {
//   try {
//     const { taskId, subtaskId } = req.params;
//     const { status, description } = req.body;
//     const { id, role, email: userEmail } = req.user;

//     const task = await Task.findOne({ _id: taskId, 'subtasks._id': subtaskId });
//     if (!task) return res.status(404).json({ error: 'Task or subtask not found' });

//     const subtask = task.subtasks.id(subtaskId);

//     // ✅ THIS IS THE FIX: Define originalStatus right here
//     const originalStatus = subtask.status;

//     // --- (All your existing validation logic stays here) ---
//     if (role === 'Member' && status === 'Completed' && (!description || description.trim() === '')) {
//       return res.status(400).json({ error: 'A completion description is required.' });
//     }
//     if (role === 'Head' && status === 'Pending' && originalStatus === 'Completed' && (!description || description.trim() === '')) {
//       return res.status(400).json({ error: 'Please provide the required changes to the member.' });
//     }
//     const isAssigned = subtask.assignedTo.some(assignedUserId => assignedUserId.equals(id));
//     if (role === 'Member' && !isAssigned) {
//         return res.status(403).json({ error: 'Forbidden: You are not assigned to this subtask.' });
//     }

//     const fieldsToUpdate = {};
//     if (status) fieldsToUpdate['subtasks.$.status'] = status;
//     if (description !== undefined) fieldsToUpdate['subtasks.$.description'] = description;

//     const updatedTask = await Task.findOneAndUpdate(
//       { '_id': taskId, 'subtasks._id': subtaskId },
//       { $set: fieldsToUpdate },
//       { new: true }
//     ).populate('team').populate('subtasks.assignedTo');

//     // --- EMAIL LOGIC ---
//     const updatedSubtask = updatedTask.subtasks.id(subtaskId);
    
//     // Scenario 1: Member completes a subtask
//     if (role === 'Member' && status === 'Completed' && originalStatus !== 'Completed') {
//       const member = await User.findById(id);
//       const headEmail = 'head.of.the.club@gmail.com'; // TODO: Replace with dynamic lookup
//       emailService.sendSubtaskCompletionEmail(updatedSubtask, member, headEmail);
//     }
    
//     // Scenario 2: Head suggests changes
//     if (role === 'Head' && status === 'Pending' && originalStatus === 'Completed') {
//       const assignedMember = await User.findById(updatedSubtask.assignedTo[0]);
//       if (assignedMember) {
//         emailService.sendChangesSuggestedEmail(updatedSubtask, assignedMember);
//       }
//     }
//     // --- END EMAIL LOGIC ---

//     res.status(200).json({ message: 'Subtask updated successfully', task: updatedTask });

//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'Failed to update subtask' });
//   }
// };




exports.updateTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    // ✅ Track when task is marked as completed
    if (req.body.status === 'Completed' && task.status !== 'Completed') {
      req.body.completedAt = new Date();
    }
    
    // If task is being reopened, clear the completion date
    if (req.body.status !== 'Completed' && task.status === 'Completed') {
      req.body.completedAt = null;
    }

    const updatedTask = await Task.findByIdAndUpdate(
      req.params.id, 
      req.body, 
      { new: true }
    );

    // Email logic for completed tasks
    if (updatedTask.status === 'Completed') {
      const assignedUserIds = updatedTask.subtasks.flatMap(s => s.assignedTo);
      const uniqueUserIds = [...new Set(assignedUserIds)];
      const involvedMembers = await User.find({ '_id': { $in: uniqueUserIds } });
      const headUser = await User.findById(req.user.id);

      if (involvedMembers.length > 0 && headUser) {
        emailService.sendMainTaskCompletionEmail(updatedTask, headUser, involvedMembers);
      }
    }

    const populatedTask = await updatedTask.populate(['team', 'subtasks.assignedTo']);
    res.json(populatedTask);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.updateSubtask = async (req, res) => {
  try {
    const { taskId, subtaskId } = req.params;
    const { status, description } = req.body;
    const { id, role, email: userEmail } = req.user;

    const task = await Task.findOne({ _id: taskId, 'subtasks._id': subtaskId });
    if (!task) return res.status(404).json({ error: 'Task or subtask not found' });

    const subtask = task.subtasks.id(subtaskId);
    const originalStatus = subtask.status;

    // Validation logic
    if (role === 'Member' && status === 'Completed' && (!description || description.trim() === '')) {
      return res.status(400).json({ error: 'A completion description is required.' });
    }
    if (role === 'Head' && status === 'Pending' && originalStatus === 'Completed' && (!description || description.trim() === '')) {
      return res.status(400).json({ error: 'Please provide the required changes to the member.' });
    }
    
    const isAssigned = subtask.assignedTo.some(assignedUserId => assignedUserId.equals(id));
    if (role === 'Member' && !isAssigned) {
        return res.status(403).json({ error: 'Forbidden: You are not assigned to this subtask.' });
    }

    const fieldsToUpdate = {};
    if (status) fieldsToUpdate['subtasks.$.status'] = status;
    if (description !== undefined) fieldsToUpdate['subtasks.$.description'] = description;
    
    // ✅ Track when subtask is completed
    if (status === 'Completed' && originalStatus !== 'Completed') {
      fieldsToUpdate['subtasks.$.completedAt'] = new Date();
    }
    
    // If subtask is being reopened, clear the completion date
    if (status !== 'Completed' && originalStatus === 'Completed') {
      fieldsToUpdate['subtasks.$.completedAt'] = null;
    }

    const updatedTask = await Task.findOneAndUpdate(
      { '_id': taskId, 'subtasks._id': subtaskId },
      { $set: fieldsToUpdate },
      { new: true }
    ).populate('team').populate('subtasks.assignedTo');

    // Email logic
    const updatedSubtask = updatedTask.subtasks.id(subtaskId);
    
    if (role === 'Member' && status === 'Completed' && originalStatus !== 'Completed') {
      const member = await User.findById(id);
      const headEmail = 'head.of.the.club@gmail.com';
      emailService.sendSubtaskCompletionEmail(updatedSubtask, member, headEmail);
    }
    
    if (role === 'Head' && status === 'Pending' && originalStatus === 'Completed') {
      const assignedMember = await User.findById(updatedSubtask.assignedTo[0]);
      if (assignedMember) {
        emailService.sendChangesSuggestedEmail(updatedSubtask, assignedMember);
      }
    }

    res.status(200).json({ message: 'Subtask updated successfully', task: updatedTask });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update subtask' });
  }
};