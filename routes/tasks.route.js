const express = require('express');
const router = express.Router();
const tasksController = require('../controllers/tasks.controller');

router.get('/', tasksController.getAllTasks);
router.get('/:id', tasksController.getTaskById);
router.get('/team/:teamId/tasks', tasksController.getTasksByTeam);
router.get('/member/:memberId/tasks', tasksController.getTasksByMember);
router.get('/status/:status/tasks', tasksController.getTasksByStatus);
router.post('/create', tasksController.createTask);
router.put('/update', tasksController.updateTask);
router.delete('/delete', tasksController.deleteTask);

module.exports = router;
