import path from "node:path";
import { fileURLToPath } from "node:url";

export interface AppEmojiSpec {
  icon: `${string}:${string}`;
  fallback: string;
  color?: string;
  strokeWidth?: number;
}

export const APP_EMOJI_DEFAULTS = {
  color: "#dbdee1",
  strokeWidth: 2,
} as const;

export const APP_EMOJI_NAME_PATTERN = /^[a-zA-Z0-9_]{2,32}$/;

export const APP_EMOJIS = {
  check: { icon: "lucide:check", fallback: "✅", color: "#57F287" },
  cross: { icon: "lucide:x", fallback: "❌", color: "#ED4245" },
  info: { icon: "lucide:info", fallback: "ℹ️" },
  warning: { icon: "lucide:triangle-alert", fallback: "⚠️" },
  hourglass: { icon: "lucide:hourglass", fallback: "⏳" },
  clock: { icon: "lucide:clock", fallback: "🕒" },
  lock: { icon: "lucide:lock", fallback: "🔒" },
  unlock: { icon: "lucide:lock-open", fallback: "🔓" },
  transcript: { icon: "lucide:file-text", fallback: "📄" },
  trash: { icon: "lucide:trash-2", fallback: "🗑️" },
  book: { icon: "lucide:book-open", fallback: "📖" },
  wave: { icon: "lucide:hand", fallback: "👋" },
  refresh: { icon: "lucide:refresh-cw", fallback: "🔄" },
  party: { icon: "lucide:party-popper", fallback: "🎉" },
  ticket: { icon: "lucide:ticket", fallback: "🎫" },
} as const satisfies Record<string, AppEmojiSpec>;

export type AppEmojiKey = keyof typeof APP_EMOJIS;

export const APP_EMOJI_KEYS = Object.keys(APP_EMOJIS) as AppEmojiKey[];

export function isAppEmojiKey(name: string): name is AppEmojiKey {
  return Object.hasOwn(APP_EMOJIS, name);
}

const ASSET_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../assets/emojis",
);

export function appEmojiAssetDir(): string {
  return ASSET_DIR;
}

export function appEmojiAssetPath(key: AppEmojiKey): string {
  return path.join(ASSET_DIR, `${key}.png`);
}
