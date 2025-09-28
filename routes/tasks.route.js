const express = require('express');
const router = express.Router();
const tasksController = require('../controllers/tasks.controller');
const { authMiddleware, adminOrHeadOnly } = require('../middlewares/auth.middleware'); 

router.get('/', authMiddleware, tasksController.getAllTasks);
router.get('/team/:teamId', authMiddleware, tasksController.getTasksByTeam);
router.get('/user/:userId', authMiddleware, tasksController.getTasksByUser);
router.get('/status/:status', authMiddleware, tasksController.getTasksByStatus);
router.get('/:id', authMiddleware, tasksController.getTaskById);
router.post('/create', authMiddleware, adminOrHeadOnly, tasksController.createTask);
router.put('/update', authMiddleware, tasksController.updateTask);
router.delete('/delete', authMiddleware, tasksController.deleteTask);

module.exports = router;
