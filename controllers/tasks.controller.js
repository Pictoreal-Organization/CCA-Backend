const { Task, Team, User } = require('../models/index');
const mongoose = require('mongoose');
const admin = require('../config/firebase');
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

    // const assignedUserIds = req.body.subtasks.flatMap(s => s.assignedTo);
    // const uniqueUserIds = [...new Set(assignedUserIds)]; // Remove duplicates
    // const assignedUsers = await User.find({ '_id': { $in: uniqueUserIds } });

    try {
      // 1. Get all assigned User IDs
      const assignedUserIds = req.body.subtasks.flatMap(s => s.assignedTo);
      const uniqueUserIds = [...new Set(assignedUserIds)];

      if (uniqueUserIds.length > 0) {
        // 2. Fetch Users to get their tokens
        const users = await User.find({ '_id': { $in: uniqueUserIds } });

        // 3. Collect all tokens into one array
        let allTokens = [];
        users.forEach(user => {
          if (user.fcmTokens && user.fcmTokens.length > 0) {
            allTokens.push(...user.fcmTokens);
          }
        });

        // 4. Send Multicast Message (if tokens exist)
        if (allTokens.length > 0) {
          const message = {
            notification: {
              title: 'New Task Assigned',
              body: `You have been assigned to: ${title}`,
            },
            data: {
              taskId: task._id.toString(),
              type: 'TASK_ASSIGNED'
            },
            tokens: allTokens,
          };

          const response = await admin.messaging().sendEachForMulticast(message);
          console.log('Notifications sent:', response.successCount);
          
          // Optional: Remove invalid tokens based on response.responses
        }
      }
    } catch (notifyError) {
      // Don't fail the request if notification fails, just log it
      console.error("Notification failed:", notifyError); 
    }

    // if (assignedUsers.length > 0) {
    //   emailService.sendTaskCreationEmail(task, assignedUsers);
    // }

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




// exports.updateTask = async (req, res) => {
//   try {
//     const task = await Task.findById(req.params.id);
//     if (!task) return res.status(404).json({ message: 'Task not found' });

//     // ✅ Track when task is marked as completed
//     if (req.body.status === 'Completed' && task.status !== 'Completed') {
//       req.body.completedAt = new Date();
//     }

//     // If task is being reopened, clear the completion date
//     if (req.body.status !== 'Completed' && task.status === 'Completed') {
//       req.body.completedAt = null;
//     }

//     const updatedTask = await Task.findByIdAndUpdate(
//       req.params.id,
//       req.body,
//       { new: true }
//     );

//     // Email logic for completed tasks
//     if (updatedTask.status === 'Completed') {
//       const assignedUserIds = updatedTask.subtasks.flatMap(s => s.assignedTo);
//       const uniqueUserIds = [...new Set(assignedUserIds)];
//       const involvedMembers = await User.find({ '_id': { $in: uniqueUserIds } });
//       const headUser = await User.findById(req.user.id);

//       // if (involvedMembers.length > 0 && headUser) {
//       //   emailService.sendMainTaskCompletionEmail(updatedTask, headUser, involvedMembers);
//       // }
//     }

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
//     const originalStatus = subtask.status;

//     // Validation logic
//     if (role === 'Member' && status === 'Completed' && (!description || description.trim() === '')) {
//       return res.status(400).json({ error: 'A completion description is required.' });
//     }
//     if (role === 'Head' && status === 'Pending' && originalStatus === 'Completed' && (!description || description.trim() === '')) {
//       return res.status(400).json({ error: 'Please provide the required changes to the member.' });
//     }

//     const isAssigned = subtask.assignedTo.some(assignedUserId => assignedUserId.equals(id));
//     if (role === 'Member' && !isAssigned) {
//       return res.status(403).json({ error: 'Forbidden: You are not assigned to this subtask.' });
//     }

//     const fieldsToUpdate = {};
//     if (status) fieldsToUpdate['subtasks.$.status'] = status;
//     if (description !== undefined) fieldsToUpdate['subtasks.$.description'] = description;

//     // ✅ Track when subtask is completed
//     if (status === 'Completed' && originalStatus !== 'Completed') {
//       fieldsToUpdate['subtasks.$.completedAt'] = new Date();
//     }

//     // If subtask is being reopened, clear the completion date
//     if (status !== 'Completed' && originalStatus === 'Completed') {
//       fieldsToUpdate['subtasks.$.completedAt'] = null;
//     }

//     const updatedTask = await Task.findOneAndUpdate(
//       { '_id': taskId, 'subtasks._id': subtaskId },
//       { $set: fieldsToUpdate },
//       { new: true }
//     ).populate('team').populate('subtasks.assignedTo');

//     // Email logic
//     const updatedSubtask = updatedTask.subtasks.id(subtaskId);

//     if (role === 'Member' && status === 'Completed' && originalStatus !== 'Completed') {
//       const member = await User.findById(id);
//       const heads = await User.find({
//         role: 'Head',
//         team: { $in: member.team } // $in checks for any match in the array
//       }).select('email'); // Only retrieve the email field for efficiency

//       if (!heads || heads.length === 0) {
//         console.warn(`No heads found for teams of member ${member.username}.`);
//         return;
//       }

//       // 4. Loop through each head and send the email
//       // for (const head of heads) {
//       //   try {
//       //     // Assuming your service sends the email asynchronously
//       //     emailService.sendSubtaskCompletionEmail(updatedSubtask, member, head.email);
//       //   } catch (emailError) {
//       //     console.error(`Failed to send email to head ${head.email}:`, emailError);
//       //   }
//       // }
//     }

//     if (role === 'Head' && status === 'Pending' && originalStatus === 'Completed') {
//       const assignedMember = await User.findById(updatedSubtask.assignedTo[0]);
//       // if (assignedMember) {
//       //   emailService.sendChangesSuggestedEmail(updatedSubtask, assignedMember);
//       // }
//     }

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

    // --- 🔔 NOTIFICATION LOGIC: TASK COMPLETED ---
    if (updatedTask.status === 'Completed') {
      try {
        // 1. Find all unique members involved in the task
        const assignedUserIds = updatedTask.subtasks.flatMap(s => s.assignedTo);
        const uniqueUserIds = [...new Set(assignedUserIds)];
        
        if (uniqueUserIds.length > 0) {
          const involvedMembers = await User.find({ '_id': { $in: uniqueUserIds } });
          
          // 2. Send Notification to all members
          await sendFcmNotification(
            involvedMembers, 
            'Task Completed 🎉', 
            `The task "${updatedTask.title}" has been marked as completed.`, 
            { taskId: updatedTask._id.toString(), type: 'TASK_COMPLETED' }
          );
        }
      } catch (notifyErr) {
        console.error("Failed to send task completion notification:", notifyErr);
      }
    }
    // --- END NOTIFICATION LOGIC ---

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
    const { id, role } = req.user; // Assumes auth middleware provides this

    const task = await Task.findOne({ _id: taskId, 'subtasks._id': subtaskId });
    if (!task) return res.status(404).json({ error: 'Task or subtask not found' });

    const subtask = task.subtasks.id(subtaskId);
    const originalStatus = subtask.status;

    // --- Validation Logic ---
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

    // --- Update Logic ---
    const fieldsToUpdate = {};
    if (status) fieldsToUpdate['subtasks.$.status'] = status;
    if (description !== undefined) fieldsToUpdate['subtasks.$.description'] = description;

    // Track completion time
    if (status === 'Completed' && originalStatus !== 'Completed') {
      fieldsToUpdate['subtasks.$.completedAt'] = new Date();
    }
    if (status !== 'Completed' && originalStatus === 'Completed') {
      fieldsToUpdate['subtasks.$.completedAt'] = null;
    }

    const updatedTask = await Task.findOneAndUpdate(
      { '_id': taskId, 'subtasks._id': subtaskId },
      { $set: fieldsToUpdate },
      { new: true }
    ).populate('team').populate('subtasks.assignedTo');

    const updatedSubtask = updatedTask.subtasks.id(subtaskId);

    // --- 🔔 NOTIFICATION LOGIC ---
    try {
      // Scenario 1: Member completes a subtask -> Notify HEADS
      if (role === 'Member' && status === 'Completed' && originalStatus !== 'Completed') {
        const member = await User.findById(id);
        
        // Find Heads of the teams this member belongs to
        const heads = await User.find({
          role: 'Head',
          team: { $in: member.team } 
        });

        if (heads.length > 0) {
          await sendFcmNotification(
            heads,
            'Subtask Completed ✅',
            `${member.name} completed: "${updatedSubtask.title}"`,
            { taskId: taskId, subtaskId: subtaskId, type: 'SUBTASK_COMPLETED' }
          );
        }
      }

      // Scenario 2: Head requests changes (Pending) -> Notify MEMBER
      if (role === 'Head' && status === 'Pending' && originalStatus === 'Completed') {
        // Find the member assigned to this subtask
        // (Assuming single assignment for simplicity, or notify all assigned)
        const assignedMemberIds = updatedSubtask.assignedTo;
        if (assignedMemberIds.length > 0) {
          const assignedMembers = await User.find({ '_id': { $in: assignedMemberIds } });
          
          await sendFcmNotification(
            assignedMembers,
            'Changes Requested ⚠️',
            `Head requested changes on: "${updatedSubtask.title}"`,
            { taskId: taskId, subtaskId: subtaskId, type: 'CHANGES_REQUESTED' }
          );
        }
      }
    } catch (notifyErr) {
      console.error("Notification error in updateSubtask:", notifyErr);
      // We swallow the error so the HTTP response doesn't fail just because notification failed
    }
    // --- END NOTIFICATION LOGIC ---

    res.status(200).json({ message: 'Subtask updated successfully', task: updatedTask });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update subtask' });
  }
};

// Helper to send notifications to a list of User objects
const sendFcmNotification = async (users, title, body, data) => {
  try {
    let allTokens = [];
    
    // Collect tokens from all users
    users.forEach(user => {
      if (user.fcmTokens && Array.isArray(user.fcmTokens)) {
        allTokens.push(...user.fcmTokens);
      }
    });

    // Filter out any empty/null tokens and ensure uniqueness
    allTokens = [...new Set(allTokens.filter(t => t))];

    if (allTokens.length === 0) return;

    const message = {
      notification: {
        title: title,
        body: body,
      },
      data: data || {},
      tokens: allTokens,
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`🔔 Sent ${response.successCount} notifications for: ${title}`);
    
    // Optional: Cleanup invalid tokens logic here if needed
  } catch (error) {
    console.error("Error in sendFcmNotification:", error);
  }
};