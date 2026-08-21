/**
 * Custom Discord emoji manifest
 *
 * The source of truth for every custom emoji the bot uses. Entries are pushed to
 * Discord by `pnpm deploy-emojis` and resolved back to ids at runtime, so no
 * environment-specific emoji id is ever committed. Dev and prod run against
 * separate bot applications and each resolves its own ids from these same names.
 *
 * Icon-backed entries are rendered from `lucide-static` at deploy time. Use
 * `file` instead for bespoke art in `emojis/assets` - required for animated
 * emojis, since GIF has no vector equivalent.
 *
 * SCOPE: these are application emojis owned by the MAIN bot, so only the main
 * bot can render them. A payload built with `Discord.Emojis.*` and sent through
 * the web bot (a separate Discord application, see `getMessageService("web")`)
 * shows the literal `<:name:id>` text instead of the image.
 *
 * Keys must satisfy Discord's naming rules and stay lowercase; see the manifest
 * unit test for the exact constraint and why it is tighter than Discord's.
 */

interface EmojiDefinitionBase {
  /**
   * Unicode emoji rendered when the custom emoji has not been deployed yet
   *
   * Resolution never returns undefined, so a bot that boots before the deploy
   * step lands still renders something sensible instead of a broken
   * `<:name:undefined>`.
   */
  readonly fallback: string;

  /**
   * Stroke colour applied when rendering. Defaults to the brand gold.
   *
   * Must be a 6-digit hex colour: it is interpolated straight into SVG markup,
   * and anything unparseable renders black, which is invisible on Discord's
   * dark theme.
   */
  readonly tint?: `#${string}`;

  /** Overrides the default stroke weight for icons that read too thin or heavy */
  readonly strokeWidth?: number;
}

interface IconEmojiDefinition extends EmojiDefinitionBase {
  /** kebab-case lucide icon name, e.g. "refresh-cw" */
  readonly icon: string;
  readonly file?: never;
}

interface FileEmojiDefinition extends EmojiDefinitionBase {
  /** Filename inside `emojis/assets`, e.g. "train.gif" */
  readonly file: string;
  readonly icon?: never;
}

export type EmojiDefinition = IconEmojiDefinition | FileEmojiDefinition;

/**
 * Every custom emoji, keyed by its Discord emoji name
 *
 * Keys must satisfy Discord's naming rules: 2-32 characters of `[A-Za-z0-9_]`.
 * The deployer validates this before uploading anything.
 */
export const emojiManifest = {
  reload: { icon: "refresh-cw", fallback: "🔄" },
} as const satisfies Record<string, EmojiDefinition>;

export type EmojiKey = keyof typeof emojiManifest;
