const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { authMiddleware, adminOnly } = require('../middlewares/auth.middleware');

router.post('/create-team', authMiddleware, adminOnly, adminController.adminCreateTeam);
router.post('/create-member', authMiddleware, adminOnly, adminController.adminCreateMember);
router.post('/create-head', authMiddleware, adminOnly, adminController.adminCreateHead);

router.delete('/:userId', authMiddleware, adminOnly, adminController.deleteUser);

router.put('/team/:teamId/head', authMiddleware, adminOnly, adminController.updateTeamHead);

router.get('/members', authMiddleware, adminOnly, adminController.getAllMembers);
router.get('/heads', authMiddleware, adminOnly, adminController.getAllHeads);
router.get('/teams', authMiddleware, adminOnly, adminController.getAllTeams);
router.get('/visible-teams', authMiddleware, adminOnly, adminController.getVisibleTeams);
router.get('/meetings', authMiddleware, adminOnly, adminController.getAllMeetings);
router.get('/tasks', authMiddleware, adminOnly, adminController.getAllTasks);
router.get('/users', authMiddleware, adminOnly, adminController.getAllUsersForAdmin);

// Get single member
router.get('/members/:id', authMiddleware, adminOnly, adminController.getSingleMember);

// Update member
router.put('/members/:id', authMiddleware, adminOnly, adminController.updateMember);

// Sync members from Google Sheet
router.post('/sync-members-from-sheet', authMiddleware, adminOnly, adminController.syncMembersFromSheet);
router.get('/sync-status', authMiddleware, adminOnly, adminController.getSyncStatus);  // ← add this

module.exports = router;
