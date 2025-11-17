import * as fs from 'fs';
import * as path from 'path';

/**
 * Configuration structure for HA permissions
 */
interface PermissionConfig {
  allowedUsers: string[];
}

/**
 * Manages user permissions for Home Assistant commands
 */
export class PermissionManager {
  private allowedUsers: Set<string> = new Set();
  private configPath: string;
  private fileWatcher: fs.FSWatcher | null = null;

  /**
   * Creates a new PermissionManager instance
   * @param configPath Path to the permissions config file
   * @param enableFileWatching Enable automatic config reload on file changes
   */
  constructor(configPath: string, enableFileWatching = true) {
    this.configPath = configPath;
    this.loadConfig();

    if (enableFileWatching) {
      this.setupFileWatcher();
    }
  }

  /**
   * Checks if a user is allowed to use HA commands
   * @param userId Discord user ID
   * @returns true if user is allowed, false otherwise
   */
  public isUserAllowed(userId: string): boolean {
    return this.allowedUsers.has(userId);
  }

  /**
   * Loads the permissions configuration from file
   */
  public loadConfig(): void {
    try {
      // Check if config file exists
      if (!fs.existsSync(this.configPath)) {
        console.warn(`[PermissionManager] Config file not found at ${this.configPath}`);
        console.warn('[PermissionManager] All users will be denied access to HA commands');
        this.allowedUsers.clear();
        return;
      }

      // Read and parse config file
      const fileContent = fs.readFileSync(this.configPath, 'utf-8');
      const config: PermissionConfig = JSON.parse(fileContent);

      // Validate config structure
      if (!config.allowedUsers || !Array.isArray(config.allowedUsers)) {
        console.error('[PermissionManager] Invalid config format: allowedUsers must be an array');
        this.allowedUsers.clear();
        return;
      }

      // Update allowed users set
      this.allowedUsers = new Set(config.allowedUsers);
      console.log(`[PermissionManager] Loaded ${this.allowedUsers.size} allowed user(s) for HA commands`);
    } catch (error) {
      console.error('[PermissionManager] Error loading config:', error);
      console.error('[PermissionManager] All users will be denied access to HA commands');
      this.allowedUsers.clear();
    }
  }

  /**
   * Sets up file watcher for automatic config reload
   */
  private setupFileWatcher(): void {
    try {
      const configDir = path.dirname(this.configPath);

      // Watch the config directory for changes
      this.fileWatcher = fs.watch(configDir, (eventType, filename) => {
        // Only reload if our config file changed
        if (filename === path.basename(this.configPath)) {
          console.log('[PermissionManager] Config file changed, reloading...');
          this.loadConfig();
        }
      });

      console.log('[PermissionManager] File watching enabled for config updates');
    } catch (error) {
      console.error('[PermissionManager] Error setting up file watcher:', error);
    }
  }

  /**
   * Stops the file watcher and cleans up resources
   */
  public destroy(): void {
    if (this.fileWatcher) {
      this.fileWatcher.close();
      this.fileWatcher = null;
      console.log('[PermissionManager] File watcher stopped');
    }
  }

  /**
   * Gets the current list of allowed user IDs
   * @returns Array of allowed user IDs
   */
  public getAllowedUsers(): string[] {
    return Array.from(this.allowedUsers);
  }

  /**
   * Gets the count of allowed users
   * @returns Number of allowed users
   */
  public getAllowedUserCount(): number {
    return this.allowedUsers.size;
  }
}
