# Future Enhancements for HA-Trigger Whitelist

This document outlines potential enhancements to the user whitelist feature for future consideration.

## Optional Enhancements

### 1. File Watching for Hot-Reload
**Benefit**: Update whitelist without restarting the bot

**Implementation**:
- Use `fs.watch()` or `chokidar` library to monitor `config/ha-permissions.json`
- Automatically reload permissions when file changes
- Add validation to prevent invalid configs from breaking the bot
- Log reload events for audit trail

**Complexity**: Low-Medium
**Priority**: Medium

---

### 2. Logging of Unauthorized Access Attempts
**Benefit**: Security monitoring and audit trail

**Implementation**:
- Log to database table: `unauthorized_access_attempts`
- Capture: user ID, username, command, timestamp, additional context
- Optional: Send alert to admin channel after N failed attempts
- Provide admin command to view recent unauthorized attempts

**Schema**:
```sql
CREATE TABLE unauthorized_access_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  command_name TEXT NOT NULL,
  attempted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  additional_data TEXT
);
```

**Complexity**: Low
**Priority**: High (Security)

---

### 3. Discord Role-Based Permissions
**Benefit**: More flexible than user IDs, leverages Discord's built-in roles

**Implementation**:
- Add `allowedRoles` array to config alongside `allowedUsers`
- Check if user has ANY of the allowed roles
- Consider guild-specific permissions (different servers, different rules)
- Fallback to user ID whitelist if role check fails

**Config Example**:
```json
{
  "allowedUsers": ["123456789012345678"],
  "allowedRoles": ["HA Admin", "Moderator"],
  "requireAllRoles": false
}
```

**Considerations**:
- Role IDs are server-specific
- Requires `interaction.member.roles` check
- More maintainable than individual user IDs

**Complexity**: Medium
**Priority**: High (Better UX)

---

### 4. Admin Commands for Whitelist Management
**Benefit**: Manage permissions via Discord without editing files

**Commands**:
- `/ha-whitelist add <user>` - Add user to whitelist
- `/ha-whitelist remove <user>` - Remove user from whitelist
- `/ha-whitelist list` - Show current whitelist
- `/ha-whitelist reload` - Manually reload config file

**Implementation**:
- Requires admin-only permission check (recursive permissions)
- Write changes back to config file
- Maintain JSON formatting and comments if possible
- Add confirmation prompts for destructive actions

**Complexity**: Medium-High
**Priority**: Medium

---

### 5. Granular Permission Levels
**Benefit**: Different users can have different levels of access

**Implementation**:
- Multiple permission levels: `admin`, `power_user`, `read_only`
- Restrict certain automations to certain permission levels
- Per-automation permissions in config

**Config Example**:
```json
{
  "users": {
    "123456789012345678": {
      "level": "admin",
      "allowedAutomations": ["*"]
    },
    "987654321098765432": {
      "level": "power_user",
      "allowedAutomations": ["automation.lights_*", "automation.climate_*"]
    }
  }
}
```

**Complexity**: High
**Priority**: Low (Nice to have)

---

### 6. Rate Limiting
**Benefit**: Prevent abuse even from authorized users

**Implementation**:
- Limit number of triggers per user per time period
- Example: 10 triggers per hour per user
- Use in-memory cache or database tracking
- Return helpful error message when limit exceeded

**Complexity**: Medium
**Priority**: Medium

---

### 7. Temporary Access Grants
**Benefit**: Give temporary access without permanent whitelist changes

**Implementation**:
- Admin command: `/ha-whitelist grant <user> <duration>`
- Store in database with expiration timestamp
- Automatic cleanup of expired grants
- Useful for guests or temporary privileges

**Complexity**: Medium
**Priority**: Low

---

### 8. Audit Log for All HA Triggers
**Benefit**: Complete history of who triggered what and when

**Implementation**:
- Already partially implemented (user tracking in database)
- Enhance with: success/failure status, response times, automation details
- Add admin command to query audit log
- Export functionality for compliance

**Note**: Database already tracks `triggeredBy` in `ha_automation_triggers` table

**Complexity**: Low (partially exists)
**Priority**: Medium

---

### 9. Multi-Factor Authentication
**Benefit**: Extra security layer for sensitive automations

**Implementation**:
- Require confirmation button click for certain automations
- Optional: Discord 2FA requirement check
- Tag certain automations as "high security" in config

**Complexity**: Medium
**Priority**: Low (Overkill for most use cases)

---

### 10. Permission Inheritance and Groups
**Benefit**: Easier management of large user bases

**Implementation**:
- Define permission groups in config
- Users inherit permissions from groups
- Example: `home_automation_users`, `admin_users`

**Config Example**:
```json
{
  "groups": {
    "ha_users": {
      "allowedCommands": ["ha-trigger"],
      "allowedAutomations": ["automation.lights_*"]
    },
    "admins": {
      "allowedCommands": ["*"]
    }
  },
  "users": {
    "123456789012345678": ["admins"],
    "987654321098765432": ["ha_users"]
  }
}
```

**Complexity**: High
**Priority**: Low

---

## Implementation Priority Recommendation

**Phase 1 (Core Security)**:
1. Logging of unauthorized access attempts
2. Discord role-based permissions

**Phase 2 (UX Improvements)**:
3. File watching for hot-reload
4. Admin commands for whitelist management

**Phase 3 (Advanced Features)**:
5. Rate limiting
6. Audit log enhancements
7. Granular permission levels

**Phase 4 (Optional)**:
8. Temporary access grants
9. Permission groups
10. Multi-factor authentication

---

## Notes

- Keep config file format simple and backward compatible
- Add migration scripts if changing config structure
- Document all permission features in README
- Consider using a permissions library if complexity grows
- Always fail-secure (deny by default if config issues)
