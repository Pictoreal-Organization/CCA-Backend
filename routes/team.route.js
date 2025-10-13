const express = require('express');
const router = express.Router();
const teamController = require('../controllers/team.controller');
const { authMiddleware, adminOrHeadOnly } = require('../middlewares/auth.middleware');

// Public / authenticated
router.get('/', authMiddleware, teamController.getAllTeams);
router.get('/visible', authMiddleware, teamController.getVisibleTeams);
router.get('/:teamId', authMiddleware, teamController.getTeamById);

// Admin or Head only
router.post('/create', authMiddleware, adminOrHeadOnly, teamController.createTeam);
router.put('/:teamId/head', authMiddleware, adminOrHeadOnly, teamController.updateTeamHead);
router.put('/:teamId/add-members', authMiddleware, adminOrHeadOnly, teamController.addMembersToTeam);
router.delete('/:teamId/remove-member/:memberId', authMiddleware, adminOrHeadOnly, teamController.removeMemberFromTeam);

module.exports = router;
