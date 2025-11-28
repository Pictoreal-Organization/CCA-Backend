const { Task, Team, User } = require('../models/index');
const mongoose = require('mongoose');
const admin = require('../config/firebase');

// Reuse the helper logic
const sendNotificationToUsers = async (userIds, title, body, data) => {
  try {
    const users = await User.find({ '_id': { $in: userIds } }).select('fcmTokens');
    let tokens = [];
    users.forEach(u => {
      if (u.fcmTokens && u.fcmTokens.length > 0) {
        tokens.push(...u.fcmTokens);
      }
    });

    if (tokens.length > 0) {
      await admin.messaging().sendEachForMulticast({
        tokens: tokens,
        data: {
          ...data,          // Your existing type/id data
          title: title,     // Move title here
          body: body        // Move body here
        }
      });
      console.log(`🔔 Silent Notification sent: ${title}`);
    }
  } catch (err) {
    console.error("❌ Notification Error:", err);
  }
};

exports.createTask = async (req, res) => {
  try {
    const task = new Task(req.body);
    await task.save();

    // --- 🔔 NOTIFICATION: Task Created ---
    // Notify all members assigned to subtasks
    const assignedIds = task.subtasks.flatMap(s => s.assignedTo.map(id => id.toString()));
    const uniqueIds = [...new Set(assignedIds)];

    await sendNotificationToUsers(
      uniqueIds,
      '📋 New Task Assigned',
      `You have been assigned to: ${task.title}`,
      { 
        type: 'TASK_CREATED', 
        taskId: task._id.toString() 
      }
    );

    res.status(201).json(task);
  } catch (err) { res.status(400).json({ error: err.message }); }
};

exports.updateTask = async (req, res) => {
  try {
    const task = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true });

    // --- 🔔 NOTIFICATION: Task Edited (General) ---
    // Notify everyone involved
    const assignedIds = task.subtasks.flatMap(s => s.assignedTo.map(id => id.toString()));
    const uniqueIds = [...new Set(assignedIds)];

    await sendNotificationToUsers(
      uniqueIds,
      '📝 Task Updated',
      `Updates on task: "${task.title}"`,
      { 
        type: 'TASK_UPDATED', 
        taskId: task._id.toString() 
      }
    );

    res.json(task);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.updateSubtask = async (req, res) => {
  try {
    const { taskId, subtaskId } = req.params;
    const { status, description } = req.body;
    const { id: userId, role, name: userName } = req.user;

    const task = await Task.findOne({ _id: taskId, 'subtasks._id': subtaskId });
    const subtask = task.subtasks.id(subtaskId);
    const oldStatus = subtask.status;

    // Update logic
    if (status) subtask.status = status;
    if (description) subtask.description = description;

    await task.save();

    console.log(`User Role: ${role}, User Name: ${userName}`);

    // --- 🔔 NOTIFICATION: Subtask Status Changed ---
    
    // 1. If Member Changed Status -> Notify Heads
    if (role === 'Member') {
      let headsToNotify = [];

      // Check if task.team is null (general task for all teams)
      if (!task.team) {
        console.log('Task is general (team is null) - notifying all heads');
        
        // Get all teams and extract all heads
        const allTeams = await Team.find({}).select('heads');
        allTeams.forEach(team => {
          if (team.heads && team.heads.length > 0) {
            headsToNotify.push(...team.heads);
          }
        });
        
        // Remove duplicates (in case a head is in multiple teams)
        headsToNotify = [...new Set(headsToNotify.map(id => id.toString()))];
        
      } else {
        console.log(`Task belongs to specific team: ${task.team}`);
        
        // Find heads of the specific team
        const team = await Team.findById(task.team);
        if (team && team.heads.length > 0) {
          headsToNotify = team.heads;
        }
      }

      // Send notification to the collected heads
      if (headsToNotify.length > 0) {
        await sendNotificationToUsers(
          headsToNotify,
          `🔄 Subtask Update: ${userName}`,
          `Status changed to ${status}: "${subtask.title}"\nNote: ${description || 'No description'}`,
          { type: 'SUBTASK_UPDATED', taskId: taskId }
        );
      } else {
        console.log('No heads found to notify');
      }
    }

    // 2. If Head Changed Status -> Notify Assigned Member
    if (role === 'Head' || role === 'Admin') {
      console.log(`Subtask Assigned To: ${subtask.assignedTo}`);
      await sendNotificationToUsers(
        subtask.assignedTo,
        `⚠️ Update on your Subtask`,
        `Head set status to ${status}: "${subtask.title}"\nNote: ${description || ''}`,
        { type: 'SUBTASK_UPDATED', taskId: taskId }
      );
    }

    res.json({ message: 'Subtask updated', task });
  } catch (err) { 
    console.error(err);
    res.status(500).json({ error: err.message }); 
  }
};

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


exports.deleteTask = async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    res.json({ msg: 'Task deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


