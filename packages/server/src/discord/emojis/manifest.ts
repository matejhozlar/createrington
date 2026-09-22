import path from "node:path";
import { fileURLToPath } from "node:url";

export interface AppEmojiSpec {
  icon: `${string}:${string}`;
  color?: string;
  strokeWidth?: number;
}

export const APP_EMOJI_DEFAULTS = {
  color: "#dbdee1",
  strokeWidth: 2,
} as const;

export const APP_EMOJI_NAME_PATTERN = /^[a-zA-Z0-9_]{2,32}$/;

export const APP_EMOJIS = {
  check: { icon: "lucide:check", color: "#57F287" },
  cross: { icon: "lucide:x", color: "#ED4245" },
  info: { icon: "lucide:info" },
  warning: { icon: "lucide:triangle-alert" },
  hourglass: { icon: "lucide:hourglass" },
  clock: { icon: "lucide:clock" },
  lock: { icon: "lucide:lock" },
  unlock: { icon: "lucide:lock-open" },
  transcript: { icon: "lucide:file-text" },
  trash: { icon: "lucide:trash-2" },
  book: { icon: "lucide:book-open" },
  wave: { icon: "lucide:hand" },
  refresh: { icon: "lucide:refresh-cw" },
  party: { icon: "lucide:party-popper" },
  ticket: { icon: "lucide:ticket" },
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
