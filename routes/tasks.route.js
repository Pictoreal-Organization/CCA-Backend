const express = require('express');
const router = express.Router();
const tasksController = require('../controllers/tasks.controller');
const { authMiddleware, adminOrHeadOnly, checkPermission } = require('../middlewares/auth.middleware'); 
const PERMISSIONS = require('../config/permissions'); 

router.get('/', authMiddleware, tasksController.getAllTasks);
router.get('/team/:teamId', authMiddleware, tasksController.getTasksByTeam);
router.get('/general', authMiddleware, tasksController.getGeneralTasks);
router.get('/user/:userId', authMiddleware, tasksController.getTasksByUser);
router.get('/user/:userId/completed', authMiddleware, tasksController.getCompletedTasksByUser);
router.get('/team/:teamId/completed', authMiddleware, adminOrHeadOnly, tasksController.getCompletedTasksByTeam);
router.get('/status/:status', authMiddleware, tasksController.getTasksByStatus);
router.get('/managed', authMiddleware, tasksController.getManagedTasks); // ✅ NEW: Coordinator managed tasks
router.get('/tasks/:id', authMiddleware,tasksController.getTaskById);
router.get('/:taskId/has-control', authMiddleware, tasksController.checkTaskControl);
router.post('/batch-check-control', authMiddleware, tasksController.batchCheckTaskControl);

router.put('/complete/:id', authMiddleware, adminOrHeadOnly, tasksController.completeTask);

// KEEP THIS LAST
router.get('/:id', authMiddleware, tasksController.getTaskById);

router.post('/create', authMiddleware, checkPermission(PERMISSIONS.TASK.CREATE), tasksController.createTask);
router.delete('/delete/:id', authMiddleware, checkPermission(PERMISSIONS.TASK.DELETE), tasksController.deleteTask);
router.put('/update/:id', authMiddleware, checkPermission(PERMISSIONS.TASK.UPDATE), tasksController.updateTask);
router.put('/:taskId/subtasks/:subtaskId/status', authMiddleware, tasksController.updateSubtask);

module.exports = router;
