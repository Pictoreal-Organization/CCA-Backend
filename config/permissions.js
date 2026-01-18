const PERMISSIONS = {
  // Meeting Permissions
  MEETING: {
    CREATE: 'MEETING_CREATE',
    READ: 'MEETING_READ',
    UPDATE: 'MEETING_UPDATE',
    DELETE: 'MEETING_DELETE',
  },
  
  // Task Permissions
  TASK: {
    CREATE: 'TASK_CREATE',
    READ: 'TASK_READ',
    UPDATE: 'TASK_UPDATE',
    DELETE: 'TASK_DELETE',
  },
  
  // Team/Member Management
  TEAM: {
    MANAGE: 'TEAM_MANAGE', // Add/Remove members
  },

  // User Management
  USER: {
    CREATE: 'USER_CREATE',
    READ: 'USER_READ',
    UPDATE: 'USER_UPDATE',
    DELETE: 'USER_DELETE',
  },

  // Role Management (Admin only usually)
  ROLE: {
    MANAGE: 'ROLE_MANAGE',
  },

  // Tag Management
  TAG: {
    CREATE: 'TAG_CREATE',
    UPDATE: 'TAG_UPDATE',
    DELETE: 'TAG_DELETE',
  },

  // Attendance
  ATTENDANCE: {
    MARK: 'ATTENDANCE_MARK',
    VIEW: 'ATTENDANCE_VIEW',
  }
};

module.exports = PERMISSIONS;
