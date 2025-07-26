const express = require('express');
const router = express.Router();
const tasksController = require('../controllers/tasks.controller');

router.get('/', tasksController.getAllTasks);
router.get('/:id', tasksController.getTaskById);
router.get('/team/:teamId', tasksController.getTasksByTeam);
router.get('/team/:memberId', tasksController.getTasksByMember);
router.get('/status/:status', tasksController.getTasksByStatus);
router.post('/assign', tasksController.assignTaskus);

module.exports = router;