const express = require('express');
const router = express.Router();
const roleController = require('../controllers/role.controller');
const { authMiddleware, adminOnly } = require('../middlewares/auth.middleware');
const PERMISSIONS = require('../config/permissions');

// Apply auth middleware to all routes
router.use(authMiddleware);

// Only Admins can manage roles
router.use(adminOnly); 

router.post('/', roleController.createRole);
router.get('/', roleController.getAllRoles);
router.get('/:id', roleController.getRoleById);
router.put('/:id', roleController.updateRole);
router.delete('/:id', roleController.deleteRole);

module.exports = router;
