import { getService, Services } from "@/services";
import type { User } from "discord.js";

/**
 * Discord server utility functions for fetching, validating, and working with Discord users
 *
 * Provides type-safe methods for common user operations including fetching user data,
 * checking bot status, validating user existence, and formatting user information
 */
export const DiscordUsers = {
  /**
   * Fetches a Discord user by their ID
   *
   * Retrieves user information from Discord's API. Returns null if the user
   * doesn't exist or if there's an error during fetching
   *
   * @param discordId - The Discord user ID to fetch
   * @returns Promise resolving to the User object or null if not found/error
   *
   * @example
   * const user = await DiscordUsers.fetch("123456")
   * if (user) {
   *  console.log(`Found user: ${user.username}`);
   * }
   */
  async fetch(discordId: string): Promise<User | null> {
    try {
      const client = await getService(Services.DISCORD_MAIN_BOT);
      return await client.users.fetch(discordId);
    } catch (error) {
      logger.error(`Failed to fetch user ${discordId}:`, error);
      return null;
    }
  },

  /**
   * Checks if a user exists in Discord
   *
   * Attempts to fetch the user and returns a boolean indicating existence
   * More efficient thatn fetching when you only need to verify existence
   *
   * @param discordId - The Discord ID to check
   * @returns Promise resolving to true if user exists, false otherwise
   *
   * @example
   * if (await DiscordUsers.exists("123456")) {
   *    console.log("User exists");
   * }
   */
  async exists(discordId: string): Promise<boolean> {
    const user = await this.fetch(discordId);
    return user !== null;
  },

  /**
   * Checks is a user is a bot account
   *
   * Fetches the user and checks their bot status. Returns false if the
   * user doesn't exists or if there's an error
   *
   * @param discordId - The Discord user ID to check
   * @returns Promise resolving to true if user is a bot, false otherwise
   *
   * @example
   * if (await DiscordUsers.isBot("123456")) {
   *    console.log("This is a bot account");
   * }
   */
  async isBot(discordId: string): Promise<boolean> {
    const user = await this.fetch(discordId);
    return user?.bot ?? false;
  },

  /**
   * Gets a user's display name (username or global name)
   *
   * Returns the user's global display name if set, otherwise falls back to username
   * Returns "Unknown User" if the user cannot be fetched
   *
   * @param discordId - The Discord user ID
   * @returns Promise resolving to the user's display name
   *
   * @example
   * cosnt name = await DiscordUsers.getDisplayName("123456");
   * console.log(`${name}`);
   */
  async getDisplayName(discordId: string): Promise<string> {
    const user = await this.fetch(discordId);
    return user?.displayName ?? "Unknown User";
  },

  /**
   * Gets a user's username (not display name)
   *
   * Returns the user's actual username. Returns "Unknown User" if the user
   * cannot be fetched
   *
   * @param discordId - The Discord user ID
   * @returns Promise resolving to the user's username
   *
   * @example
   * const username = await DiscordUsers.getUsername("123456");
   * console.log(`Username: ${username}`);
   */
  async getUsername(discordId: string): Promise<string> {
    const user = await this.fetch(discordId);
    return user?.username ?? "Unknown User";
  },

  /**
   * Gets a user's tag (username#discriminator or new username format)
   *
   * Returns the user's tag in the format username#discriminator for legacy accounts
   * or just the username for new accounts. Returns "Unknown User" if fetch fails
   *
   * @param discordId - The Discord user ID
   * @returns Promise resolving to the user's tag
   *
   * @example
   * const tag = await DiscordUsers.getTag("123456");
   * console.log(`User tag: ${tag}`);
   */
  async getTag(discordId: string): Promise<string> {
    const user = await this.fetch(discordId);
    return user?.tag ?? "Unknown User";
  },

  /**
   * Gets a user's avatar URL
   *
   * Returns the URL to the user's avatar image. Supports custom size and format options
   * Returns null if the user doesn't exist or has no avatar
   *
   * @param discordId - The Discord user ID
   * @param options - Optional avatar display options
   * @param options.size - Image size (16-4096, power of 2)
   * @param options.dynamic - Whether to return animated format for animated avatars
   * @param options.format - Specific image format (png, jpg, webp, gif)
   * @returns Promise resolving to the avatar URL or null
   *
   * @example
   * const avatarUrl = await DiscordUsers.getAvatarUrl("123456", { size: 256 });
   * if (avatarUrl){
   *    console.log(`Avatar: ${avatarUrl}`);
   * }
   */
  async getAvatarUrl(
    discordId: string,
    options?: {
      size?: number;
      dynamic?: boolean;
      format?: "png" | "jpg" | "webp" | "gif";
    },
  ): Promise<string | null> {
    const user = await this.fetch(discordId);
    if (!user) return null;

    return user.displayAvatarURL({
      size: options?.size as any,
      extension: options?.format,
    });
  },

  /**
   * Formats a user mention string
   *
   * Creates a Discord mention string that will ping the user when sent in a message
   * Does not validate if the user exists
   *
   * @param discordId - The Discord user ID to mention
   * @returns The formatted mention string
   *
   * @example
   * const mention = DiscordUsers.mention("123456");
   * await channel.send(`Hello ${mention}!`); // "Hello @username!"
   */
  mention(discordId: string): string {
    return `<@${discordId}>`;
  },

  /**
   * Fetches multiple users in parallel
   *
   * Efficiently fetches multiple users at once. Failed fetches return null
   * in the results array without throwing errors
   *
   * @param discordIds - Array of Discord user IDs to fetch
   * @returns Promise resolving to an array of Users (null for failed fetches)
   *
   * @example
   * const users = await DiscordUsers.fetch("1", "2", "3");
   * const validUsers = users.filter(u => u !== null);
   */
  async fetchMany(discordIds: string[]): Promise<(User | null)[]> {
    return Promise.all(discordIds.map((id) => this.fetch(id)));
  },

  /**
   * Gets the cached user if available, otherwise fetches from API
   *
   * More efficient than fetch() when the user might already be cached
   * Returns null if user doesn't exist or on error
   *
   * @param discordId - The Discord user ID
   * @returns Promise resolving to the User object or null
   *
   * @example
   * const user = await DiscordUsers.resolve("123456");
   */
  async resolve(discordId: string): Promise<User | null> {
    try {
      const client = await getService(Services.DISCORD_MAIN_BOT);

      const cached = client.users.cache.get(discordId);

      if (cached) return cached;

      return await this.fetch(discordId);
    } catch (error) {
      logger.error(`Failed to resolve user ${discordId}:`, error);
      return null;
    }
  },

  /**
   * Checks if a user was created before a specific date
   *
   * Useful for detecting new accounts or validating account age
   * Returns false if user doesn't exist
   *
   * @param discordId - The Discord user ID
   * @param date - The date to compare against
   * @returns Promise resolving to true if account is older than the date
   *
   * @example
   * const isOld = await DiscordUsers.isCreatedBefore("1234", new Date("2020-01-01"));
   */
  async isCreatedBefore(discordId: string, date: Date): Promise<boolean> {
    const user = await this.fetch(discordId);
    if (!user) return false;

    return user.createdAt < date;
  },

  /**
   * Gets the account creation date
   *
   * Returns when the Discord was created
   * Returns null if user doesn't exist
   *
   * @param discordId - The Discord user ID
   * @returns Promise resolving to the creation date or null
   *
   * @example
   * const created = await DiscordUsers.getCreatedAt("123456");
   * console.log(`Account created: ${created?.toLocaleDateString()`});
   */
  async getCreatedAt(discordId: string): Promise<Date | null> {
    const user = await this.fetch(discordId);
    return user?.createdAt ?? null;
  },
};

/**
 * Type representing DiscordUsers utility object
 * Useful for dependency injection and testing
 */
export type DiscordUsersUtility = typeof DiscordUsers;
