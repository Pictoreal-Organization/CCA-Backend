const express = require('express');
const router = express.Router();
const tasksController = require('../controllers/tasks.controller');
const { authMiddleware, adminOrHeadOnly } = require('../middlewares/auth.middleware'); 

router.get('/', authMiddleware, tasksController.getAllTasks);
router.get('/team/:teamId', authMiddleware, tasksController.getTasksByTeam);
router.get('/general', authMiddleware, tasksController.getGeneralTasks);
router.get('/user/:userId', authMiddleware, tasksController.getTasksByUser);
router.get('/user/:userId/completed', authMiddleware, tasksController.getCompletedTasksByUser);
router.get('/team/:teamId/completed', authMiddleware, adminOrHeadOnly, tasksController.getCompletedTasksByTeam);
router.get('/status/:status', authMiddleware, tasksController.getTasksByStatus);
router.get('/tasks/:id', authMiddleware,tasksController.getTaskById);

// KEEP THIS LAST
router.get('/:id', authMiddleware, tasksController.getTaskById);

router.post('/create', authMiddleware, adminOrHeadOnly, tasksController.createTask);
router.delete('/delete/:id', authMiddleware, adminOrHeadOnly, tasksController.deleteTask);
router.put('/update/:id', authMiddleware, tasksController.updateTask);
router.put('/:taskId/subtasks/:subtaskId/status', authMiddleware, tasksController.updateSubtask);

module.exports = router;
