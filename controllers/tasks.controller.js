const { Task, Team, User } = require('../models/index');
const mongoose = require('mongoose');
const admin = require('../config/firebase');

// // Reuse the helper logic
// const sendNotificationToUsers = async (userIds, title, body, data) => {
//   try {
//     const users = await User.find({ '_id': { $in: userIds } }).select('fcmTokens');
//     let tokens = [];
//     users.forEach(u => {
//       if (u.fcmTokens && u.fcmTokens.length > 0) {
//         tokens.push(...u.fcmTokens);
//       }
//     });

//     if (tokens.length > 0) {
//       await admin.messaging().sendEachForMulticast({
//         tokens: tokens,
//         data: {
//           ...data,          // Your existing type/id data
//           title: title,     // Move title here
//           body: body        // Move body here
//         }
//       });
//       console.log(`🔔 Silent Notification sent: ${title}`);
//     }
//   } catch (err) {
//     console.error("❌ Notification Error:", err);
//   }
// };

const sendNotificationToUsers = async (userIds, title, body, data) => {
  try {
    const users = await User.find({ '_id': { $in: userIds } }).select('fcmTokens');
    let tokens = [];
    users.forEach(u => {
      if (u.fcmTokens && u.fcmTokens.length > 0) {
        tokens.push(...u.fcmTokens);
      }
    });

    // Remove duplicates
    tokens = [...new Set(tokens.filter(t => t))];

    if (tokens.length === 0) {
      console.log("⚠️ No FCM tokens found for users");
      return;
    }

    // ✅ CRITICAL FIX: Add notification object
    const message = {
      notification: {
        title: title,
        body: body,
      },
      data: {
        ...data,
        title: title,
        body: body
      },
      android: {
        notification: {
          channelId: 'high_importance_channel',
          priority: 'high',
          sound: 'default',
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          }
        }
      },
      tokens: tokens,
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    
    console.log(`🔔 Notification sent: ${title}`);
    console.log(`✅ Success: ${response.successCount}, ❌ Failed: ${response.failureCount}`);
    
    if (response.failureCount > 0) {
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          console.log(`❌ Failed token ${idx}: ${resp.error?.message}`);
        }
      });
    }
  } catch (err) {
    console.error("❌ Notification Error:", err);
  }
};

const hasTaskControl = async (userId, userRole, task) => {
  try {
    if (userRole === 'Admin') return true; // Admin always has control

    // Load teams to check heads
    const organizerTeam = task.organizerTeam 
      ? await Team.findById(task.organizerTeam).select('heads')
      : null;

    const taskTeam = task.team
      ? await Team.findById(task.team).select('heads')
      : null;

    const organizerHeads = organizerTeam ? organizerTeam.heads.map(id => id.toString()) : [];
    const taskHeads = taskTeam ? taskTeam.heads.map(id => id.toString()) : [];

    // User is head of task team?
    if (taskHeads.includes(userId.toString())) return true;

    // User is head of organizer team?
    if (organizerHeads.includes(userId.toString())) return true;

    return false;
  } catch (err) {
    console.error("Control check error:", err);
    return false;
  }
};

exports.checkTaskControl = async (req, res) => {
  try {
    const { id: userId, role } = req.user;
    const { taskId } = req.params;

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const control = await hasTaskControl(userId, role, task);

    return res.status(200).json({ hasControl: control });
  } catch (err) {
    console.error("checkTaskControl error:", err);
    return res.status(500).json({ error: 'Failed to check task control' });
  }
};



exports.createTask = async (req, res) => {
  try {
    const { team: userTeam } = req.user;

    const task = new Task({
      ...req.body,
      startDate: new Date(),
      organizerTeam: userTeam
    });
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

    const tasks = await Task.find({ team: teamId, status: { $ne: "Completed" } })
      .populate('team')
      .populate('subtasks.assignedTo');

    res.status(200).json(tasks);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch team tasks' });
  }
};

exports.getGeneralTasks = async (req, res) => {
  try {
    const tasks = await Task.find({
      team: null,           // team field is null
      status: { $ne: "Completed" }  // optional → only active tasks
    })
      .populate("subtasks.assignedTo")
      // .sort({ createdAt: -1 });

    res.status(200).json(tasks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch general tasks" });
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
      status: 'Completed',
      'subtasks.assignedTo': userId,
    }).sort({ deadline: -1 })
      .populate('team')
      .populate('subtasks.assignedTo'); 

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

    // const tasks = await Task.find({
    //   team: teamId,
    //   status: 'Completed'
    // })
    //   .sort({ completedAt: -1 }) // Latest completed first
    //   .populate('team')
    //   .populate('subtasks.assignedTo');

    const tasks = await Task.find({
      status: 'Completed',
      $or: [
        { team: teamId },            // tasks assigned to that team
        { organizerTeam: teamId }    // tasks created by that team
      ]
    })
      .sort({ completedAt: -1 }) // Latest completed first
      .populate('team')
      .populate('organizerTeam')   // ⬅️ Also populate organizerTeam
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

exports.completeTask = async (req, res) => {
  try {
    const { id: userId, role, name: userName } = req.user;
    const taskId = req.params.id;

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Verify all subtasks are completed
    const allSubtasksCompleted = task.subtasks.length > 0 && 
      task.subtasks.every(s => s.status === 'Completed');

    if (!allSubtasksCompleted) {
      return res.status(400).json({ 
        error: 'Cannot complete task: Not all subtasks are completed' 
      });
    }

    // Update task status and completedAt timestamp
    task.status = 'Completed';
    task.completedAt = new Date();
    await task.save();

    // --- 🔔 NOTIFICATION: Task Completed ---
    // Notify all members assigned to subtasks
    const assignedIds = task.subtasks.flatMap(s => s.assignedTo.map(id => id.toString()));
    const uniqueIds = [...new Set(assignedIds)];

    await sendNotificationToUsers(
      uniqueIds,
      '✅ Task Completed',
      `Task "${task.title}" has been marked as completed by ${userName}`,
      { 
        type: 'TASK_COMPLETED', 
        taskId: task._id.toString() 
      }
    );

    res.status(200).json({ 
      message: 'Task completed successfully', 
      task 
    });
  } catch (err) { 
    console.error(err);
    res.status(500).json({ error: err.message }); 
  }
};

exports.batchCheckTaskControl = async (req, res) => {
  try {
    const { id: userId, role } = req.user;
    const { taskIds } = req.body;

    if (!taskIds || !Array.isArray(taskIds)) {
      return res.status(400).json({ error: 'taskIds array is required' });
    }

    // Fetch all tasks in one query
    const tasks = await Task.find({ _id: { $in: taskIds } });

    // Check control for all tasks in parallel
    const controlChecks = await Promise.all(
      tasks.map(async (task) => {
        const control = await hasTaskControl(userId, role, task);
        return { taskId: task._id.toString(), hasControl: control };
      })
    );

    // Convert array to object map
    const controlMap = {};
    controlChecks.forEach(({ taskId, hasControl }) => {
      controlMap[taskId] = hasControl;
    });

    // Add false for any taskIds that weren't found
    taskIds.forEach(id => {
      if (!(id in controlMap)) {
        controlMap[id] = false;
      }
    });

    return res.status(200).json({ controlMap });
  } catch (err) {
    console.error("batchCheckTaskControl error:", err);
    return res.status(500).json({ error: 'Failed to check task control' });
  }
};