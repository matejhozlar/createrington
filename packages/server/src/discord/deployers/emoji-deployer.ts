import "@/logger.global";
import config from "@/config";
import { REST, Routes } from "discord.js";
import {
  emojiManifest,
  type EmojiDefinition,
  type EmojiKey,
} from "@/discord/emojis/manifest";
import { renderEmoji, toDataUri } from "@/discord/emojis/rasterize";

const BOT_TOKEN = config.discord.bots.main.token;
const BOT_ID = config.discord.bots.main.id;

/**
 * Discord REST API client configured with bot token
 */
const rest = new REST({ version: "10" }).setToken(BOT_TOKEN);

/** Discord's emoji naming rule: 2-32 characters of alphanumerics and underscores */
const VALID_NAME = /^[A-Za-z0-9_]{2,32}$/;

interface ApplicationEmoji {
  id: string;
  name: string;
  animated: boolean;
}

/**
 * Names passed as `--force <name>` are deleted and recreated
 *
 * Discord's edit endpoint can only rename an emoji, never swap its image, and
 * it exposes no content hash to diff against - so changed artwork has to be
 * re-uploaded deliberately rather than detected.
 *
 * @returns The set of emoji names to force-replace
 * @private
 */
function parseForcedNames(): Set<string> {
  const forced = new Set<string>();
  const args = process.argv.slice(2);

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--force" && args[i + 1]) {
      forced.add(args[i + 1]);
      i++;
    } else if (args[i] === "--force-all") {
      Object.keys(emojiManifest).forEach((name) => forced.add(name));
    }
  }

  return forced;
}

/**
 * Marks a failure as Discord being unreachable rather than the manifest being wrong
 *
 * The two need different outcomes: a bad manifest is a commit bug that will
 * never succeed and must fail the build, while a transient API error should not
 * take down a deploy over artwork the bot has a Unicode fallback for.
 */
class DiscordUnavailableError extends Error {}

/**
 * Runs a Discord REST call, tagging any failure as transient
 *
 * @param operation - The REST call to run
 * @param description - What was being attempted, for the log line
 * @returns Whatever the call resolved to
 * @private
 */
async function callDiscord<T>(
  operation: () => Promise<T>,
  description: string,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new DiscordUnavailableError(`${description}: ${detail}`);
  }
}

/**
 * Fetches the emojis currently owned by the bot application
 *
 * The list endpoint wraps its payload in an `items` key rather than returning a
 * bare array, unlike most Discord collection endpoints.
 *
 * @returns The application's existing emojis
 * @private
 */
async function fetchExisting(): Promise<ApplicationEmoji[]> {
  const response = (await callDiscord(
    () => rest.get(Routes.applicationEmojis(BOT_ID)),
    "listing application emojis",
  )) as { items?: ApplicationEmoji[] } | ApplicationEmoji[];

  if (Array.isArray(response)) return response;
  return response.items ?? [];
}

/**
 * Renders and uploads a single manifest entry
 *
 * @param name - The emoji name to create
 * @param definition - The manifest entry to render
 * @private
 */
async function createEmoji(
  name: string,
  definition: EmojiDefinition,
): Promise<void> {
  // Rendered outside callDiscord: a render failure is a manifest bug, not an
  // outage, and must fail the build rather than being shrugged off
  const { data, mime } = await renderEmoji(name, definition);

  const created = (await callDiscord(
    () =>
      rest.post(Routes.applicationEmojis(BOT_ID), {
        body: { name, image: toDataUri(data, mime) },
      }),
    `creating "${name}"`,
  )) as ApplicationEmoji;

  const source = definition.icon
    ? `lucide:${definition.icon}`
    : definition.file;
  logger.info(
    ` + ${name} <- ${source} (${(data.length / 1024).toFixed(1)} KiB) -> ${created.id}`,
  );
}

/**
 * Reconciles the manifest against the bot application's deployed emojis
 *
 * Creates anything missing, force-replaces anything named on the command line,
 * and reports - but never deletes - emojis that exist on Discord without a
 * manifest entry. Deleting an emoji retroactively breaks every past message that
 * used it, so pruning stays a deliberate human decision.
 *
 * @returns Promise resolving when reconciliation is complete
 */
export async function deployEmojis(): Promise<void> {
  try {
    const names = Object.keys(emojiManifest);
    const invalid = names.filter((name) => !VALID_NAME.test(name));
    if (invalid.length > 0) {
      throw new Error(
        `Invalid emoji name(s): ${invalid.join(", ")}. Discord allows 2-32 characters of [A-Za-z0-9_].`,
      );
    }

    const forced = parseForcedNames();
    const unmatchedForce = [...forced].filter((name) => !names.includes(name));
    if (unmatchedForce.length > 0) {
      // --force is the only way to update changed artwork, so a typo silently
      // doing nothing and reporting success is the wrong failure mode
      throw new Error(
        `--force named emoji(s) not in the manifest: ${unmatchedForce.join(", ")}`,
      );
    }

    logger.info(`Reconciling ${names.length} emoji(s) for app ${BOT_ID}...`);

    const existing = await fetchExisting();
    const existingByName = new Map(existing.map((e) => [e.name, e]));

    let created = 0;
    let replaced = 0;
    let skipped = 0;

    for (const name of names) {
      const definition: EmojiDefinition = emojiManifest[name as EmojiKey];
      const current = existingByName.get(name);

      if (current && forced.has(name)) {
        await callDiscord(
          () => rest.delete(Routes.applicationEmoji(BOT_ID, current.id)),
          `deleting "${name}" before replacing it`,
        );
        await createEmoji(name, definition);
        replaced++;
      } else if (current) {
        logger.debug(` = ${name} already deployed (${current.id})`);
        skipped++;
      } else {
        await createEmoji(name, definition);
        created++;
      }
    }

    const orphans = existing.filter((e) => !names.includes(e.name));
    if (orphans.length > 0) {
      logger.warn(
        `${orphans.length} emoji(s) on Discord have no manifest entry: ${orphans
          .map((e) => e.name)
          .join(
            ", ",
          )}. Left untouched - deleting one breaks every past message that used it.`,
      );
    }

    logger.info(
      `Emojis reconciled: ${created} created, ${replaced} replaced, ${skipped} unchanged`,
    );
    process.exit(0);
  } catch (error) {
    if (error instanceof DiscordUnavailableError) {
      // Emojis are cosmetic and every entry has a Unicode fallback, so a
      // Discord-side failure must not abort the deploy that carries migrations
      // and the application build. The next deploy reconciles what was missed.
      logger.error(
        `Emoji deploy skipped, Discord unreachable (${error.message}). The bot renders Unicode fallbacks until the next deploy.`,
      );
      process.exit(0);
    }

    logger.error("Failed to deploy emojis:", error);
    process.exit(1);
  }
}

deployEmojis();
