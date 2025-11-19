const Tag = require('../models/tag.model');

// Get all active tags
exports.getAllTags = async (req, res) => {
  try {
    const tags = await Tag.find({ isActive: true }).sort({ name: 1 });
    res.status(200).json(tags);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch tags' });
  }
};

// Create a new tag (Admin only)
exports.createTag = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ msg: 'Tag name is required' });
    }

    // Check if tag already exists
    const existing = await Tag.findOne({ 
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } 
    });

    if (existing) {
      return res.status(400).json({ msg: 'Tag already exists' });
    }

    const tag = new Tag({ name: name.trim() });
    await tag.save();

    res.status(201).json({ msg: 'Tag created successfully', tag });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update tag name (Admin only)
exports.updateTag = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ msg: 'Tag name is required' });
    }

    const tag = await Tag.findByIdAndUpdate(
      id,
      { name: name.trim() },
      { new: true }
    );

    if (!tag) {
      return res.status(404).json({ msg: 'Tag not found' });
    }

    res.status(200).json({ msg: 'Tag updated successfully', tag });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Delete tag (Admin only) - soft delete by setting isActive to false
exports.deleteTag = async (req, res) => {
  try {
    const { id } = req.params;

    const tag = await Tag.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );

    if (!tag) {
      return res.status(404).json({ msg: 'Tag not found' });
    }

    res.status(200).json({ msg: 'Tag deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Permanently delete tag (Admin only) - use with caution
exports.permanentDeleteTag = async (req, res) => {
  try {
    const { id } = req.params;

    const tag = await Tag.findByIdAndDelete(id);

    if (!tag) {
      return res.status(404).json({ msg: 'Tag not found' });
    }

    res.status(200).json({ msg: 'Tag permanently deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};