const { Task } = require('../models/schema');

exports.getAllTasks = async (req, res) => {
    try {
        const tasks = await Task.find();
        res.status(200).json(tasks);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch tasks' });
    }
};

exports.getTaskById = async (req, res) => {
    try {
        const task = await Task.findById(req.params.id);
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }
        res.status(200).json(task);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch task' });
    }
};

exports.getTasksByTeam = async (req, res) => {
    try {
        const teamId = req.query.teamId || req.params.teamId;
        if (!teamId) return res.status(400).json({ error: 'teamId is required' });

        const tasks = await Task.find({ team: teamId });
        res.json(tasks);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error fetching team tasks' });
    }
};

exports.getTasksByMember = async (req, res) => {
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
}

exports.getTasksByStatus = async (req, res) => {
    try {
        const status = req.params.status;
        if (!['Pending', 'In Progress', 'Completed'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status value' });
        }
        const tasks = await Task.find({ status });
        res.status(200).json(tasks);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch tasks' });
    }
};

exports.assignTask = async (req, res) => {
    try {
        const task = new Task(req.body);
        await task.save();
        res.status(201).json(task);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
}
