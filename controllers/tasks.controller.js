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
        const teamId = req.params.teamId || req.query.teamId;
        if (!teamId) {
            return res.status(400).json({ error: 'Team ID is required' });
        }
        const tasks = await Task.find({ team: teamId });
        res.status(200).json(tasks);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch tasks' });
    }
};

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