/**
 * Cooldown scope types that determine how cooldowns are applied
 * - "user": Per-user cooldown (same user, any channel/guild)
 * - "global": Global cooldown (affects all users)
 * - "channel": Per-channel cooldown (any user in same channel)
 * - "guild": Per-guild cooldown (any user in same guild, falls back to user if no guild)
 */
export enum CooldownType {
  USER = "user",
  GLOBAL = "global",
  CHANNEL = "channel",
  GUILD = "guild",
}

/**
 * Interaction context required for cooldown operations
 */
export interface CooldownContext {
  userId: string;
  channelId: string;
  guildId: string | null;
}

/**
 * Internal cooldown entry stored in the manager
 */
interface CooldownEntry {
  expiresAt: number;
  userId?: string;

  metadata?: {
    commandName: string;
    type: CooldownType;
    startedAt: number;
  };
}

/**
 * Configuration for command cooldowns
 */
interface CooldownConfig {
  /** Cooldown duration in seconds */
  duration: number;
  /** Type of cooldown scope */
  type: CooldownType;
  /** Optional custom cooldown message to display to users */
  message?: string;
}

/**
 * Statistics about active cooldowns
 */
export interface CooldownStats {
  totalCooldowns: number;
  totalCommands: number;
  byCommand: Record<string, number>;
  byType?: Record<CooldownType, number>;
}

/**
 * Manages command cooldowns with support for multiple cooldown types
 *
 * Supports user-based, global, channel-based, and guild-based cooldowns.
 * Automatically cleans up expired cooldowns using setTimeout.
 */
export class CooldownManager {
  private cooldowns = new Map<string, Map<string, CooldownEntry>>();

  /**
   * Generates a unique cooldown key based on command name and cooldown type
   *
   * @param commandName - Name of the command
   * @param type - Type of cooldown scope
   * @param interaction - Interaction context
   * @param interaction.userId - Discord user ID to generate the cooldown for
   * @param interaction.channelId - Discord channel ID to generate the cooldown for
   * @param interaction.guildId - Optional global guild cooldown for a specific command
   * @returns Unique key string for the cooldown entry
   *
   * @example
   * getKey("ping", "user", { userId: "123", ... }) // "ping:user:123"
   * getKey("announcement", "global", { ... }) // "announcement:global"
   */
  private getKey(
    commandName: string,
    type: CooldownType,
    interaction: CooldownContext,
  ): string {
    switch (type) {
      case CooldownType.USER:
        return `${commandName}:user:${interaction.userId}`;
      case CooldownType.GLOBAL:
        return `${commandName}:global`;
      case CooldownType.CHANNEL:
        return `${commandName}:channel:${interaction.channelId}`;
      case CooldownType.GUILD:
        return interaction.guildId
          ? `${commandName}:guild:${interaction.guildId}`
          : `${commandName}:user:${interaction.userId}`;
      default:
        return `${commandName}:user:${interaction.userId}`;
    }
  }

  /**
   * Gets the exact expiration time of a cooldown, if it is still active
   *
   * This is useful for displaying a live countdown to users using
   * Discord relative timestamps (<t:UNIX:R>), without modifying
   * or extending the cooldown itself
   *
   * @param commandName - Name of the command to check
   * @param type - Cooldown scope type (user, global, channel, guild)
   * @param interaction - Interaction context (user, channel, guild)
   * @returns
   *    - A UNIX timestamp in milliseconds representing when the cooldown expires
   *    - null if the cooldown does not exist or has already expired
   */
  public getExpiry(
    commandName: string,
    type: CooldownType,
    interaction: CooldownContext,
  ): number | null {
    const key = this.getKey(commandName, type, interaction);
    const timestamps = this.cooldowns.get(commandName);
    if (!timestamps) return null;

    const entry = timestamps.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now >= entry.expiresAt) return null;

    return entry.expiresAt;
  }

  /**
   * Checks if a command is currently on cooldown
   *
   * @param commandName - Name of the command to check
   * @param cfg - Cooldown configuration
   * @param interaction - Interaction context
   * @param interaction.userId - Discord user ID to check for
   * @param interaction.channelId - Discord channel ID to check for
   * @param interaction.guildId - Discord guild ID to check for
   * @returns Remaining cooldown time in seconds, or null if not on cooldown
   *
   * @example
   * const remaining = check("ping", config, interaction);
   * if (remaining !== null) {
   *   console.log(`Wait ${remaining} seconds`);
   * }
   */
  public check(
    commandName: string,
    cfg: CooldownConfig,
    interaction: CooldownContext,
  ): number | null {
    const key = this.getKey(commandName, cfg.type, interaction);

    if (!this.cooldowns.has(commandName)) {
      this.cooldowns.set(commandName, new Map());
    }

    const now = Date.now();
    const timestamps = this.cooldowns.get(commandName)!;

    if (timestamps.has(key)) {
      const entry = timestamps.get(key)!;

      if (now < entry.expiresAt) {
        const remaining = Math.ceil((entry.expiresAt - now) / 1000);
        return remaining;
      }

      timestamps.delete(key);
    }

    return null;
  }

  /**
   * Sets a cooldown for a command
   *
   * Creates a cooldown entry that will automatically expire after the configured duration.
   * Uses setTimeout to clean up the entry when it expires.
   *
   * @param commandName - Name of the command to set cooldown for
   * @param cfg - Cooldown configuration
   * @param interaction - Interaction context
   * @param interaction.userId - Discord user ID to set the cooldown for
   * @param interaction.channelId - Discord channel ID to set the cooldown for
   * @param interaction.guildId - Discord guild ID to set cooldown in
   */
  public set(
    commandName: string,
    cfg: CooldownConfig,
    interaction: CooldownContext,
  ): void {
    const key = this.getKey(commandName, cfg.type, interaction);

    if (!this.cooldowns.has(commandName)) {
      this.cooldowns.set(commandName, new Map());
    }

    const now = Date.now();
    const timestamps = this.cooldowns.get(commandName)!;
    const expiresAt = now + cfg.duration * 1000;

    timestamps.set(key, {
      expiresAt,
      userId: interaction.userId,
    });

    setTimeout(() => {
      timestamps.delete(key);

      if (timestamps.size === 0) {
        this.cooldowns.delete(commandName);
      }
    }, cfg.duration * 1000);
  }

  /**
   * Resets a specific cooldown entry
   *
   * @param commandName - Name of the command
   * @param type - Type of cooldown scope
   * @param interaction - Interaction context
   * @param interaction.userId - Discord user ID to reset cooldowns for
   * @param interaction.channelId - Discord channel ID to reset cooldowns for
   * @param interaction.guildId - Discord guild ID to reset the cooldowns in
   * @returns True if a cooldown was reset, false if none existed
   */
  public reset(
    commandName: string,
    type: CooldownType,
    interaction: CooldownContext,
  ): boolean {
    const key = this.getKey(commandName, type, interaction);
    const timestamps = this.cooldowns.get(commandName);

    if (timestamps && timestamps.has(key)) {
      timestamps.delete(key);
      return true;
    }

    return false;
  }

  /**
   * Resets all cooldowns for a specific command
   *
   * @param commandName - Name of the command to reset
   * @returns True if the command had cooldowns to reset, false otherwise
   */
  public resetCommand(commandName: string): boolean {
    return this.cooldowns.delete(commandName);
  }

  /**
   * Resets all cooldowns for a specific user across all commands
   *
   * @param userId - Discord user ID
   * @returns Number of cooldowns that were reset
   */
  public resetUser(userId: string): number {
    let count = 0;

    this.cooldowns.forEach((timestamps, commandName) => {
      timestamps.forEach((entry, key) => {
        if (entry.userId === userId || key.includes(`:user:${userId}`)) {
          timestamps.delete(key);
          count++;
        }
      });

      if (timestamps.size === 0) {
        this.cooldowns.delete(commandName);
      }
    });

    return count;
  }

  /**
   * Gets statistics about active cooldowns
   *
   * @returns Object containing:
   *   - totalCooldowns: Total number of active cooldown entries
   *   - totalCommands: Number of commands with active cooldowns
   *   - byCommand: Object mapping command names to their cooldown counts
   *
   * @example
   * const stats = getStats();
   * logger.info(`${stats.totalCooldowns} active cooldowns across ${stats.totalCommands} commands`);
   */
  public getStats() {
    let totalCooldowns = 0;
    const commandStats: Record<string, number> = {};

    this.cooldowns.forEach((timestamps, commandName) => {
      const count = timestamps.size;
      totalCooldowns += count;
      commandStats[commandName] = count;
    });

    const stats: CooldownStats = {
      totalCooldowns,
      totalCommands: this.cooldowns.size,
      byCommand: commandStats,
    };

    return stats;
  }
}

/**
 * Singleton instance of the cooldown manager
 */
export const cooldownManager = new CooldownManager();
