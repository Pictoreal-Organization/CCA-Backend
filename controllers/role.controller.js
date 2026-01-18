const Role = require('../models/role.model');
const { User } = require('../models');

// Create a new role
exports.createRole = async (req, res) => {
  try {
    const { name, description, permissions } = req.body;
    
    // Slug generation
    const slug = name.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');

    const existingRole = await Role.findOne({ slug });
    if (existingRole) {
      return res.status(400).json({ msg: 'Role already exists' });
    }

    const role = new Role({
      name,
      slug,
      description,
      permissions
    });

    await role.save();
    res.status(201).json(role);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
};

// Get all roles
exports.getAllRoles = async (req, res) => {
  try {
    const roles = await Role.find({});
    res.json(roles);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
};

// Get single role
exports.getRoleById = async (req, res) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) return res.status(404).json({ msg: 'Role not found' });
    res.json(role);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
};

// Update role
exports.updateRole = async (req, res) => {
  try {
    const { name, description, permissions } = req.body;
    const role = await Role.findById(req.params.id);

    if (!role) return res.status(404).json({ msg: 'Role not found' });

    if (name) {
      role.name = name;
      role.slug = name.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
    }
    if (description) role.description = description;
    if (permissions) role.permissions = permissions;

    await role.save();
    res.json(role);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
};

// Delete role
exports.deleteRole = async (req, res) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) return res.status(404).json({ msg: 'Role not found' });

    if (role.isSystem) {
      return res.status(400).json({ msg: 'Cannot delete system roles' });
    }

    // Check if any user is using this role
    const usersWithRole = await User.countDocuments({ role: role._id });
    if (usersWithRole > 0) {
      return res.status(400).json({ msg: 'Cannot delete role assigned to users. Reassign them first.' });
    }

    await Role.findByIdAndDelete(req.params.id); // Use findByIdAndDelete directly on model
    res.json({ msg: 'Role deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
};
