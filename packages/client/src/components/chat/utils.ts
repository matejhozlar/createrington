import type { CachedMessage } from "@createrington/shared/socket";
import { MessageSource } from "@createrington/shared/socket";
import { bluemapUrl } from "@/lib/minecraft";
import type { MessageGroup } from "./types";

const XAERO_WAYPOINT_REGEX =
  /xaero-waypoint:([^:]+):[^:]*:(-?\d+|~):(-?\d+|~):(-?\d+|~):[^:]*:[^:]*:[^:]*:(Internal-[\w-]+)/g;

export function transformWaypoints(text: string): string {
  return text.replace(
    XAERO_WAYPOINT_REGEX,
    (_, name, x, y, z, dimensionId: string) => {
      const safeX = x === "~" ? 0 : Number(x);
      const safeY = y === "~" ? 64 : Number(y);
      const safeZ = z === "~" ? 0 : Number(z);

      const url = bluemapUrl(dimensionId, safeX, safeY, safeZ);

      return `[${name} (${safeX}, ${safeY}, ${safeZ})](${url})`;
    },
  );
}

export function formatTime(raw: Date | string | undefined): string {
  if (!raw) return "";
  const d = raw instanceof Date ? raw : new Date(raw);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return d.toLocaleDateString("en-US", { weekday: "short" });

  const isSameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    ...(isSameYear ? {} : { year: "numeric" }),
  });
}

export function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000);
  if (totalMinutes < 1) return "< 1m";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

// Mentions are resolved server-side in MessageCacheService; this only handles <t:...> timestamps.
export function processDiscordTimestamps(text: string): string {
  return text.replace(
    /<t:(\d+)(?::([tTdDfFR]))?>/g,
    (_match, ts: string, style?: string) => {
      const date = new Date(Number(ts) * 1000);
      if (Number.isNaN(date.getTime())) return _match;
      switch (style) {
        case "R": {
          const diffSec = Math.round((Date.now() - date.getTime()) / 1000);
          const abs = Math.abs(diffSec);
          const suffix = diffSec >= 0 ? "ago" : "from now";
          if (abs < 60) return `just now`;
          if (abs < 3600) return `${Math.floor(abs / 60)}m ${suffix}`;
          if (abs < 86400) return `${Math.floor(abs / 3600)}h ${suffix}`;
          return `${Math.floor(abs / 86400)}d ${suffix}`;
        }
        case "t":
          return date.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });
        case "T":
          return date.toLocaleTimeString();
        case "d":
          return date.toLocaleDateString();
        case "D":
          return date.toLocaleDateString([], {
            day: "numeric",
            month: "long",
            year: "numeric",
          });
        case "F":
          return date.toLocaleDateString([], {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          });
        case "f":
        default:
          return date.toLocaleDateString([], {
            day: "numeric",
            month: "long",
            year: "numeric",
          });
      }
    },
  );
}

export function resolveAuthor(message: CachedMessage) {
  const source = (message.source as MessageSource) ?? MessageSource.DISCORD;
  let displayName = message.authorDisplayname || message.authorUsername;
  let avatarUrl = message.authorAvatarUrl;

  if (source === MessageSource.MINECRAFT && message.minecraftData) {
    displayName = message.minecraftData.playerName;
  } else if (source === MessageSource.WEB && message.webData) {
    displayName = message.webData.originalAuthor.displayName;
    avatarUrl = message.webData.originalAuthor.avatarUrl;
  }
  return { displayName, avatarUrl, source };
}

export function groupMessages(messages: CachedMessage[]): MessageGroup[] {
  const groups: MessageGroup[] = [];

  for (const msg of messages) {
    const { displayName, avatarUrl, source } = resolveAuthor(msg);
    const groupKey = `${msg.authorUsername}::${source}`;

    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.key === groupKey) {
      lastGroup.messages.push(msg);
    } else {
      groups.push({
        key: groupKey,
        displayName,
        avatarUrl,
        source,
        messages: [msg],
      });
    }
  }

  return groups;
}

export function groupHasHighlight(
  group: MessageGroup,
  highlighted: Set<string>,
): boolean {
  return group.messages.some((m) => highlighted.has(m.messageId));
}
