import fs from "node:fs/promises";
import type { ApplicationEmoji, Client, ClientApplication } from "discord.js";
import {
  APP_EMOJI_KEYS,
  appEmojiAssetPath,
  isAppEmojiKey,
  type AppEmojiKey,
} from "@/discord/emojis";

export interface AppEmojiSummary {
  key: AppEmojiKey;
  name: string;
  id: string;
  animated: boolean;
  url: string;
}

export interface AppEmojiSyncOptions {
  replace?: boolean;
  prune?: boolean;
}

export interface AppEmojiSyncResult {
  kept: AppEmojiKey[];
  created: AppEmojiKey[];
  replaced: AppEmojiKey[];
  failed: AppEmojiKey[];
  pruned: string[];
}

/**
 * Keeps the main bot's application emojis in step with the hardcoded manifest
 * and resolves manifest keys to `<:name:id>` tokens. Application emojis belong
 * to the bot's Discord application rather than the guild, so only the main bot
 * can render them. Startup uploads whatever the manifest lists but Discord
 * lacks; re-uploading changed images or deleting unlisted emojis is left to
 * the explicit `sync` options because both invalidate existing emoji IDs.
 */
export class AppEmojiService {
  private readonly emojis = new Map<AppEmojiKey, ApplicationEmoji>();

  constructor(private readonly client: Client) {}

  /** Uploads missing manifest emojis and caches the application's emoji set; failures are logged, never thrown. */
  async initialize(): Promise<void> {
    try {
      const result = await this.sync();
      logger.info(
        `AppEmojiService ready (${result.kept.length} kept, ${result.created.length} uploaded, ${result.failed.length} failed)`,
      );
    } catch (error) {
      logger.error("Failed to sync application emojis:", error);
    }
  }

  /** Reconciles Discord with the manifest: uploads missing emojis, re-uploads every manifest emoji with `replace`, deletes unlisted emojis with `prune`. */
  async sync(options: AppEmojiSyncOptions = {}): Promise<AppEmojiSyncResult> {
    const application = this.requireApplication();
    const existing = await application.emojis.fetch();
    const byName = new Map<string, ApplicationEmoji>();
    for (const emoji of existing.values()) {
      byName.set(emoji.name, emoji);
    }

    const result: AppEmojiSyncResult = {
      kept: [],
      created: [],
      replaced: [],
      failed: [],
      pruned: [],
    };
    this.emojis.clear();

    for (const key of APP_EMOJI_KEYS) {
      const current = byName.get(key);
      if (current && !options.replace) {
        this.emojis.set(key, current);
        result.kept.push(key);
        continue;
      }

      try {
        const attachment = await this.readImage(key);
        if (current) await application.emojis.delete(current);
        const uploaded = await application.emojis.create({
          attachment,
          name: key,
        });
        this.emojis.set(key, uploaded);
        (current ? result.replaced : result.created).push(key);
      } catch (error) {
        result.failed.push(key);
        logger.error(`Failed to upload application emoji "${key}":`, error);
      }
    }

    if (options.prune) {
      for (const [name, emoji] of byName) {
        if (isAppEmojiKey(name)) continue;
        await application.emojis.delete(emoji);
        result.pruned.push(name);
      }
    }

    return result;
  }

  /** The `<:name:id>` token for a manifest key, or an empty string when that emoji is not uploaded. */
  token(key: AppEmojiKey): string {
    const emoji = this.emojis.get(key);
    if (!emoji) {
      logger.warn(`Application emoji "${key}" is not available`);
      return "";
    }
    return emoji.toString();
  }

  /** Every uploaded manifest emoji with its CDN image URL, in manifest order. */
  list(): AppEmojiSummary[] {
    const summaries: AppEmojiSummary[] = [];
    for (const key of APP_EMOJI_KEYS) {
      const emoji = this.emojis.get(key);
      if (!emoji) continue;
      summaries.push({
        key,
        name: emoji.name,
        id: emoji.id,
        animated: emoji.animated ?? false,
        url: emoji.imageURL({ size: 64 }),
      });
    }
    return summaries;
  }

  private async readImage(key: AppEmojiKey): Promise<Buffer> {
    try {
      return await fs.readFile(appEmojiAssetPath(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new Error(
          `No rendered image for "${key}", run pnpm render-emojis and commit the result`,
        );
      }
      throw error;
    }
  }

  private requireApplication(): ClientApplication {
    const application = this.client.application;
    if (!application) {
      throw new Error("Discord client has no application, is it logged in?");
    }
    return application;
  }
}
