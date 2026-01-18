require('dotenv').config();
const mongoose = require('mongoose');
const Role = require('./models/role.model');
const PERMISSIONS = require('./config/permissions');

const seedRoles = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const allPermissions = [];
    Object.values(PERMISSIONS).forEach(group => {
      allPermissions.push(...Object.values(group));
    });

    const roles = [
      {
        name: 'Admin',
        slug: 'admin',
        description: 'System Administrator with full access',
        permissions: allPermissions,
        isSystem: true
      },
      {
        name: 'Head',
        slug: 'head',
        description: 'Club Head with management capabilities',
        permissions: [
          PERMISSIONS.MEETING.CREATE,
          PERMISSIONS.MEETING.UPDATE,
          PERMISSIONS.MEETING.DELETE,
          PERMISSIONS.TASK.CREATE,
          PERMISSIONS.TASK.UPDATE,
          PERMISSIONS.TASK.DELETE,
          PERMISSIONS.TEAM.MANAGE,
          PERMISSIONS.TAG.CREATE,
          PERMISSIONS.TAG.UPDATE,
          PERMISSIONS.ATTENDANCE.MARK,
          PERMISSIONS.ATTENDANCE.VIEW,
          PERMISSIONS.USER.READ,
        ],
        isSystem: true
      },
      {
        name: 'Coordinator',
        slug: 'coordinator',
        description: 'Tag-specific manager',
        permissions: [
          PERMISSIONS.MEETING.CREATE,
          PERMISSIONS.MEETING.UPDATE,
          PERMISSIONS.MEETING.DELETE,
          PERMISSIONS.TASK.CREATE,
          PERMISSIONS.TASK.UPDATE,
          PERMISSIONS.TASK.DELETE,
          PERMISSIONS.ATTENDANCE.MARK,
          PERMISSIONS.ATTENDANCE.VIEW,
        ],
        isSystem: true
      },
      {
        name: 'Member',
        slug: 'member',
        description: 'Regular club member',
        permissions: [
          PERMISSIONS.MEETING.READ,
          PERMISSIONS.TASK.READ,
          PERMISSIONS.ATTENDANCE.VIEW,
        ],
        isSystem: true
      }
    ];

    for (const role of roles) {
      await Role.findOneAndUpdate(
        { slug: role.slug },
        role,
        { upsert: true, new: true }
      );
      console.log(`Role ${role.name} seeded/updated`);
    }

    console.log('Roles seeded successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding roles:', error);
    process.exit(1);
  }
};

seedRoles();
