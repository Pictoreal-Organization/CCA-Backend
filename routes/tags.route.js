const express = require('express');
const router = express.Router();
const tagsController = require('../controllers/tags.controller');
const { authMiddleware, adminOnly } = require('../middlewares/auth.middleware');

// Get all tags (accessible by all authenticated users)
router.get('/', authMiddleware, tagsController.getAllTags);

// Admin-only routes
router.post('/create', authMiddleware, adminOnly, tagsController.createTag);
router.put('/update/:id', authMiddleware, adminOnly, tagsController.updateTag);
router.delete('/delete/:id', authMiddleware, adminOnly, tagsController.deleteTag);
router.delete('/permanent/:id', authMiddleware, adminOnly, tagsController.permanentDeleteTag);

module.exports = router;