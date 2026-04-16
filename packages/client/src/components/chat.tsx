import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { mcHeadsAvatar } from "@/lib/external-urls";
import { useParams } from "react-router-dom";
import { useWebSocket } from "@/contexts/websocket";
import { useServerData } from "@/contexts/server-data";
import { usePlayerData } from "@/contexts/player-data";
import { useAuth } from "@/contexts/auth";
import type {
  CachedMessage,
  SubscriptionType,
} from "@createrington/shared/socket";
import { MessageSource } from "@createrington/shared/socket";
import { Loading } from "./loading-spinner";
import {
  Send,
  Paperclip,
  X,
  Maximize2,
  ChevronDown,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSidebar } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { messagesApi } from "@/services/api/user/messages";

// ============================================================================
// Types & Helpers
// ============================================================================

const XAERO_WAYPOINT_REGEX =
  /xaero-waypoint:([^:]+):[^:]*:(-?\d+|~):(-?\d+|~):(-?\d+|~):[^:]*:[^:]*:[^:]*:(Internal-[\w-]+)/g;

function transformWaypoints(text: string): string {
  return text.replace(
    XAERO_WAYPOINT_REGEX,
    (_, name, x, y, z, dimensionId: string) => {
      let world = "world";
      let badge = "🌍";

      if (dimensionId.includes("nether")) {
        world = "world_the_nether";
        badge = "🔴";
      } else if (dimensionId.includes("end")) {
        world = "world_the_end";
        badge = "🟣";
      }

      const safeX = x === "~" ? "0" : x;
      const safeY = y === "~" ? "64" : y;
      const safeZ = z === "~" ? "0" : z;

      const url = `/blue-map#${world}:${safeX}:${safeY}:${safeZ}:1500:0:0:0:0:perspective`;

      return `${badge} [${name} (${safeX}, ${safeY}, ${safeZ})](${url})`;
    },
  );
}

interface SourceConfig {
  label: string;
  color: string;
  bgColor: string;
  accentColor: string;
}

const SOURCE_CONFIG: Record<MessageSource, SourceConfig> = {
  [MessageSource.SYSTEM]: {
    label: "System",
    color: "text-muted-foreground",
    bgColor: "bg-muted/40",
    accentColor: "hsl(var(--muted-foreground))",
  },
  [MessageSource.DISCORD]: {
    label: "Discord",
    color: "text-discord-foreground",
    bgColor: "bg-discord/10",
    accentColor: "var(--discord)",
  },
  [MessageSource.MINECRAFT]: {
    label: "Minecraft",
    color: "text-chart-2",
    bgColor: "bg-chart-2/10",
    accentColor: "hsl(var(--chart-2))",
  },
  [MessageSource.WEB]: {
    label: "Web",
    color: "text-chart-3",
    bgColor: "bg-chart-3/10",
    accentColor: "hsl(var(--chart-3))",
  },
};

/**
 * Returns a `now` timestamp (ms) that updates every `intervalMs`.
 * The value is captured inside setInterval (an effect), so no impure call
 * happens during render — it's just reading state.
 */
function useRelativeTick(intervalMs = 60_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

// Auto-expanding textarea: grows with content, caps at maxRows
function useAutoResize(
  ref: React.RefObject<HTMLTextAreaElement | null>,
  value: string,
  maxRows = 6,
) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    el.style.overflow = "hidden";
    el.style.height = "auto";

    const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 20;
    const paddingY =
      parseFloat(getComputedStyle(el).paddingTop) +
      parseFloat(getComputedStyle(el).paddingBottom);
    const maxHeight = lineHeight * maxRows + paddingY;
    const capped = el.scrollHeight >= maxHeight;

    el.style.height = (capped ? maxHeight : el.scrollHeight) + "px";
    el.style.overflow = capped ? "auto" : "hidden";
  }, [value, ref, maxRows]);
}

function formatTime(raw: Date | string | undefined): string {
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

/**
 * Format a duration in ms into a human-readable "Xh Ym" or "Xm" string.
 */
function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000);
  if (totalMinutes < 1) return "< 1m";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

/**
 * Replace Discord timestamp syntax with readable text before markdown rendering.
 * Mentions are resolved server-side in MessageCacheService.
 */
function processDiscordTimestamps(text: string): string {
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

// Resolve display name + avatar from a CachedMessage
function resolveAuthor(message: CachedMessage) {
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

// Group consecutive messages by the same logical author + source
interface MessageGroup {
  key: string;
  displayName: string;
  avatarUrl?: string;
  source: MessageSource;
  messages: CachedMessage[];
}

function groupMessages(messages: CachedMessage[]): MessageGroup[] {
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

// ============================================================================
// Shared Markdown Renderer
// ============================================================================

function ChatMarkdown({
  children,
  variant = "body",
}: {
  children: string;
  variant?: "body" | "embed-title" | "embed-body";
}) {
  const isTitle = variant === "embed-title";
  const isEmbed = variant === "embed-body";

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none break-words leading-relaxed select-text">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => (
            <p
              className={cn(
                "my-0.5",
                isTitle
                  ? "text-sm font-semibold text-primary"
                  : isEmbed
                    ? "text-sm text-muted-foreground"
                    : "text-sm text-foreground",
              )}
            >
              {children}
            </p>
          ),
          a: ({ children, href }) => {
            const isChannelMention =
              href?.includes("discord.com/channels/") ?? false;

            if (isChannelMention) {
              return (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-[3px] bg-discord/15 px-0.5 text-discord-foreground hover:bg-discord/30 hover:text-white"
                >
                  {children}
                </a>
              );
            }

            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "hover:underline",
                  isTitle ? "text-primary font-semibold" : "text-primary",
                )}
              >
                {children}
              </a>
            );
          },
          code: ({
            inline,
            children,
          }: {
            inline?: boolean;
            children?: React.ReactNode;
          }) =>
            inline ? (
              <code
                className={cn(
                  "rounded font-mono",
                  isTitle
                    ? "bg-sidebar-accent px-1.5 py-0.5 text-xs text-primary font-semibold"
                    : isEmbed
                      ? "bg-sidebar-accent px-1.5 py-0.5 text-xs text-muted-foreground"
                      : "bg-sidebar-accent px-1.5 py-0.5 text-sm text-foreground",
                )}
              >
                {children}
              </code>
            ) : (
              <code
                className={cn(
                  "block font-mono",
                  isEmbed ? "text-xs" : "text-sm",
                )}
              >
                {children}
              </code>
            ),
          pre: ({ children }) => (
            <pre
              className={cn(
                "my-1.5 overflow-x-auto rounded-lg p-3",
                isEmbed
                  ? "bg-sidebar p-2 text-xs"
                  : "bg-sidebar-accent text-sm",
              )}
            >
              {children}
            </pre>
          ),
          ul: ({ children }) => (
            <ul
              className={cn(
                "my-0.5 list-disc pl-4",
                isEmbed
                  ? "text-xs text-muted-foreground"
                  : "text-sm text-foreground",
              )}
            >
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol
              className={cn(
                "my-0.5 list-decimal pl-4",
                isEmbed
                  ? "text-xs text-muted-foreground"
                  : "text-sm text-foreground",
              )}
            >
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li
              className={isEmbed ? "text-muted-foreground" : "text-foreground"}
            >
              {children}
            </li>
          ),
          blockquote: ({ children }) => (
            <blockquote
              className={cn(
                "my-1.5 border-l-2 border-primary pl-3 italic",
                isEmbed
                  ? "border-primary/50 pl-2 text-xs text-muted-foreground/80"
                  : "text-muted-foreground",
              )}
            >
              {children}
            </blockquote>
          ),
          h1: ({ children }) => (
            <h1
              className={cn(
                "my-1.5 font-bold",
                isEmbed
                  ? "text-sm text-muted-foreground"
                  : "text-lg text-foreground",
              )}
            >
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2
              className={cn(
                "my-1.5 font-bold",
                isEmbed
                  ? "text-sm text-muted-foreground"
                  : "text-base text-foreground",
              )}
            >
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3
              className={cn(
                "my-1 font-bold",
                isEmbed
                  ? "text-xs text-muted-foreground"
                  : "text-sm text-foreground",
              )}
            >
              {children}
            </h3>
          ),
          strong: ({ children }) => (
            <strong
              className={cn(
                "font-semibold",
                isTitle
                  ? "text-primary"
                  : isEmbed
                    ? "text-muted-foreground"
                    : "text-foreground",
              )}
            >
              {children}
            </strong>
          ),
          em: ({ children }) => (
            <em
              className={cn(
                "italic",
                isTitle
                  ? "text-primary font-semibold"
                  : isEmbed
                    ? "text-muted-foreground"
                    : "text-foreground",
              )}
            >
              {children}
            </em>
          ),
        }}
      >
        {processDiscordTimestamps(children)}
      </ReactMarkdown>
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function Avatar({
  url,
  name,
  isOnline,
}: {
  url?: string;
  name: string;
  isOnline?: boolean;
}) {
  const [broken, setBroken] = useState(false);
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="relative shrink-0">
      {url && !broken ? (
        <img
          src={url}
          alt={name}
          className="size-9 rounded-full object-cover ring-2 ring-sidebar ring-offset-1 ring-offset-background"
          onError={() => setBroken(true)}
        />
      ) : (
        <div className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-chart-4 text-xs font-semibold text-white ring-2 ring-sidebar ring-offset-1 ring-offset-background">
          {initials}
        </div>
      )}

      {isOnline !== undefined && (
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-background",
            isOnline ? "bg-green-500" : "bg-destructive",
          )}
        />
      )}
    </div>
  );
}

function SourceBadge({ source }: { source: MessageSource }) {
  const config = SOURCE_CONFIG[source];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.25 text-[10px] font-semibold uppercase tracking-wider",
        config.bgColor,
        config.color,
      )}
    >
      {config.label}
    </span>
  );
}

function ImageTile({
  url,
  alt,
  onFullscreen,
  onLoad,
  className,
}: {
  url: string;
  alt: string;
  onFullscreen: () => void;
  onLoad?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-lg border border-border bg-sidebar-accent",
        className,
      )}
    >
      <img
        src={url}
        alt={alt}
        onLoad={onLoad}
        className="w-full h-full cursor-pointer object-cover transition-transform duration-200 group-hover:scale-105"
        onClick={onFullscreen}
      />
      <button
        onClick={onFullscreen}
        className="absolute right-1.5 top-1.5 rounded-md bg-background/70 p-1 opacity-0 backdrop-blur-sm transition-opacity duration-150 group-hover:opacity-100"
      >
        <Maximize2 className="size-3.5 text-foreground" />
      </button>
    </div>
  );
}

function MessageImageGrid({
  attachments,
  onLoad,
  onFullscreen,
}: {
  attachments: { url: string; filename: string }[];
  onLoad?: () => void;
  onFullscreen: (url: string, alt: string) => void;
}) {
  const count = attachments.length;

  if (count === 1) {
    const img = attachments[0];
    return (
      <div className="mt-2 max-w-sm">
        <ImageTile
          url={img.url}
          alt={img.filename}
          onLoad={onLoad}
          onFullscreen={() => onFullscreen(img.url, img.filename)}
          className="max-h-64 w-full"
        />
      </div>
    );
  }

  if (count === 2) {
    return (
      <div className="mt-2 grid max-w-sm grid-cols-2 gap-1.5">
        {attachments.map((img, i) => (
          <ImageTile
            key={i}
            url={img.url}
            alt={img.filename}
            onLoad={onLoad}
            onFullscreen={() => onFullscreen(img.url, img.filename)}
            className="h-36"
          />
        ))}
      </div>
    );
  }

  const [first, ...rest] = attachments;
  return (
    <div
      className="mt-2 grid max-w-sm grid-cols-2 grid-rows-2 gap-1.5"
      style={{ height: "18rem" }}
    >
      <ImageTile
        url={first.url}
        alt={first.filename}
        onLoad={onLoad}
        onFullscreen={() => onFullscreen(first.url, first.filename)}
        className="row-span-2"
      />
      {rest.slice(0, 2).map((img, i) => {
        const isLastVisible = i === 1 && rest.length > 2;
        const overflow = rest.length - 2;
        return (
          <div key={i} className="relative">
            <ImageTile
              url={img.url}
              alt={img.filename}
              onLoad={onLoad}
              onFullscreen={() => onFullscreen(img.url, img.filename)}
              className="h-full"
            />
            {isLastVisible && (
              <div
                className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/60 cursor-pointer"
                onClick={() => onFullscreen(img.url, img.filename)}
              >
                <span className="text-lg font-bold text-white">
                  +{overflow}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ImageFullscreen({
  url,
  alt,
  onClose,
}: {
  url: string;
  alt: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full bg-sidebar-accent p-2 backdrop-blur-sm transition-colors hover:bg-sidebar-accent/80"
      >
        <X className="size-6 text-foreground cursor-pointer" />
      </button>
      <img
        src={url}
        alt={alt}
        className="max-h-full max-w-full rounded-lg object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

function MessageRow({
  message,
  isFirst,
  tick,
  onImageLoad,
}: {
  message: CachedMessage;
  isFirst: boolean;
  tick: number;
  onImageLoad?: () => void;
}) {
  void tick;

  const [fullscreenImage, setFullscreenImage] = useState<{
    url: string;
    alt: string;
  } | null>(null);

  const imageAttachments = message.attachments.filter((a) =>
    a.contentType?.startsWith("image/"),
  );

  const isImageOnly =
    !message.content &&
    imageAttachments.length > 0 &&
    message.embeds.length === 0;
  const needsInlineTimestamp = !isFirst && isImageOnly;

  return (
    <>
      <div
        className={cn(
          "group relative pl-[3.25rem] transition-all duration-500",
          isFirst ? "pt-0" : "pt-0.5",
        )}
      >
        {!isFirst && !isImageOnly && (
          <span className="absolute right-0 top-0 opacity-0 text-[11px] text-muted-foreground/60 transition-opacity duration-150 group-hover:opacity-100">
            {formatTime(message.createdAt)}
            {message.editedAt && (
              <span className="ml-1 opacity-60">(edited)</span>
            )}
          </span>
        )}

        {message.content && (
          <ChatMarkdown variant="body">
            {transformWaypoints(message.content)}
          </ChatMarkdown>
        )}

        {imageAttachments.length > 0 && (
          <MessageImageGrid
            attachments={imageAttachments}
            onLoad={onImageLoad}
            onFullscreen={(url, alt) => setFullscreenImage({ url, alt })}
          />
        )}

        {needsInlineTimestamp && (
          <span className="mt-1 block text-[11px] text-muted-foreground/50">
            {formatTime(message.createdAt)}
            {message.editedAt && (
              <span className="ml-1 opacity-60">(edited)</span>
            )}
          </span>
        )}

        {message.embeds.map((embed, i) => {
          const isMedia =
            embed.type === "gifv" ||
            embed.type === "image" ||
            embed.type === "video";

          if (isMedia) {
            const mediaUrl =
              embed.video?.url || embed.image?.url || embed.thumbnail?.url;
            if (!mediaUrl) return null;

            const isVideo = !!embed.video?.url;
            return isVideo ? (
              <video
                key={i}
                src={mediaUrl}
                autoPlay
                loop
                muted
                playsInline
                className="mt-2 max-h-64 max-w-sm rounded"
                onLoadedData={onImageLoad}
              />
            ) : (
              <img
                key={i}
                src={mediaUrl}
                alt={embed.title || ""}
                className="mt-2 max-h-64 max-w-sm rounded object-contain"
                onLoad={onImageLoad}
              />
            );
          }

          return (
            <div
              key={i}
              className="mt-2 overflow-hidden rounded-lg border border-border bg-card/60 p-3"
              style={{
                borderLeftWidth: "3px",
                borderLeftColor:
                  embed.color !== undefined
                    ? `#${embed.color.toString(16).padStart(6, "0")}`
                    : "var(--primary)",
              }}
            >
              {embed.author && (
                <div className="mb-1 flex items-center gap-1.5">
                  {embed.author.iconUrl && (
                    <img
                      src={embed.author.iconUrl}
                      alt=""
                      className="size-5 rounded-full object-cover"
                    />
                  )}
                  <span className="text-sm font-semibold text-foreground">
                    {embed.author.url ? (
                      <a
                        href={embed.author.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline"
                      >
                        {embed.author.name}
                      </a>
                    ) : (
                      embed.author.name
                    )}
                  </span>
                </div>
              )}

              <div className="flex gap-4">
                <div className="min-w-0 flex-1">
                  {embed.title && (
                    <ChatMarkdown variant="embed-title">
                      {embed.title}
                    </ChatMarkdown>
                  )}
                  {embed.description && (
                    <div className={embed.title ? "mt-1" : ""}>
                      <ChatMarkdown variant="embed-body">
                        {embed.description}
                      </ChatMarkdown>
                    </div>
                  )}

                  {embed.fields && embed.fields.length > 0 && (
                    <div className="mt-2 grid grid-cols-3 gap-x-2 gap-y-1.5">
                      {embed.fields.map((field, j) => (
                        <div
                          key={j}
                          className={field.inline ? "" : "col-span-3"}
                        >
                          <div className="text-xs font-semibold text-foreground">
                            {field.name}
                          </div>
                          <ChatMarkdown variant="embed-body">
                            {field.value}
                          </ChatMarkdown>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {embed.thumbnail && (
                  <img
                    src={embed.thumbnail.url}
                    alt=""
                    className="size-16 shrink-0 rounded object-cover"
                  />
                )}
              </div>

              {embed.image && (
                <img
                  src={embed.image.url}
                  alt=""
                  className="mt-2 max-h-64 max-w-sm rounded object-contain"
                />
              )}

              {embed.footer && (
                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
                  {embed.footer.iconUrl && (
                    <img
                      src={embed.footer.iconUrl}
                      alt=""
                      className="size-4 rounded-full"
                    />
                  )}
                  <span>{embed.footer.text}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {fullscreenImage && (
        <ImageFullscreen
          url={fullscreenImage.url}
          alt={fullscreenImage.alt}
          onClose={() => setFullscreenImage(null)}
        />
      )}
    </>
  );
}

function groupHasHighlight(
  group: MessageGroup,
  highlighted: Set<string>,
): boolean {
  return group.messages.some((m) => highlighted.has(m.messageId));
}

function MessageGroupComponent({
  group,
  prevSource,
  tick,
  onImageLoad,
  isOnline,
  hasHighlight,
  onHighlightEnd,
}: {
  group: MessageGroup;
  prevSource?: MessageSource;
  tick: number;
  onImageLoad?: () => void;
  isOnline?: boolean;
  hasHighlight: boolean;
  onHighlightEnd?: (messageIds: string[]) => void;
}) {
  const config = SOURCE_CONFIG[group.source];
  const showDivider = prevSource !== undefined && prevSource !== group.source;

  return (
    <>
      {showDivider && (
        <div className="flex items-center gap-3 px-4 py-2">
          <div className={cn("h-px flex-1 bg-border")} />
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider border",
              group.source === MessageSource.DISCORD &&
                "border-discord/30 bg-discord/10 text-discord-foreground",
              group.source === MessageSource.MINECRAFT &&
                "border-chart-2/30 bg-chart-2/10 text-chart-2",
              group.source === MessageSource.WEB &&
                "border-chart-3/30 bg-chart-3/10 text-chart-3",
              group.source === MessageSource.SYSTEM &&
                "border-muted-foreground/30 bg-muted/40 text-muted-foreground",
            )}
          >
            {config.label}
          </span>
          <div className={cn("h-px flex-1 bg-border")} />
        </div>
      )}

      <div
        className={cn(
          "group/msg-group relative flex gap-3 px-4 py-2.5 transition-colors duration-150 hover:bg-sidebar-accent/20",
          hasHighlight && "animate-new-message",
        )}
        onAnimationEnd={(e) => {
          if (e.animationName === "highlight-bg" && onHighlightEnd) {
            onHighlightEnd(group.messages.map((m) => m.messageId));
          }
        }}
      >
        <div className="shrink-0 pt-0.5">
          <Avatar
            url={group.avatarUrl}
            name={group.displayName}
            isOnline={isOnline}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">
              {group.displayName}
            </span>

            <SourceBadge source={group.source} />

            {group.messages[0]?.isBot &&
              group.source !== MessageSource.MINECRAFT && (
                <span
                  className={cn(
                    "rounded px-1.5 py-0.25 text-[10px] font-semibold uppercase tracking-wider",
                    config.bgColor,
                    config.color,
                  )}
                >
                  Bot
                </span>
              )}

            <span className="ml-auto text-[11px] text-muted-foreground/50">
              {formatTime(group.messages[0]?.createdAt)}
            </span>
          </div>

          {group.messages.map((msg, i) => (
            <MessageRow
              key={msg.messageId}
              message={msg}
              isFirst={i === 0}
              tick={tick}
              onImageLoad={onImageLoad}
            />
          ))}
        </div>
      </div>
    </>
  );
}

function ImagePreview({
  file,
  onRemove,
}: {
  file: File;
  onRemove: () => void;
}) {
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => {
    return () => URL.revokeObjectURL(url);
  }, [url]);

  return (
    <div className="relative inline-block">
      <img
        src={url}
        alt="preview"
        className="h-20 w-20 rounded-lg object-cover ring-1 ring-border"
      />
      <button
        onClick={onRemove}
        className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 transition-colors hover:bg-destructive/90"
      >
        <X className="size-3 text-white cursor-pointer" />
      </button>
      <div className="absolute bottom-1 left-1 rounded bg-background/80 px-1.5 py-0.5 text-xs text-foreground backdrop-blur-sm">
        {(file.size / 1024 / 1024).toFixed(1)}MB
      </div>
    </div>
  );
}

// ============================================================================
// Player List Panel (slides over the sidebar on desktop)
// ============================================================================

/**
 * A single row in the player list panel.
 * Re-renders every tick so the session duration stays live.
 */
function PlayerRow({
  uuid,
  username,
  sessionStart,
  now,
  isCollapsed,
}: {
  uuid: string;
  username: string;
  sessionStart: Date | string;
  /** Current timestamp snapshot from the parent's tick — pure state, no Date.now() here */
  now: number;
  /** True when the sidebar is in icon-collapsed mode */
  isCollapsed: boolean;
}) {
  const avatarUrl = mcHeadsAvatar(uuid);
  const [broken, setBroken] = useState(false);

  const start =
    sessionStart instanceof Date
      ? sessionStart.getTime()
      : new Date(sessionStart).getTime();
  const sessionMs = now - start;

  const initials = username.charAt(0).toUpperCase();

  return (
    <div
      className={cn(
        "flex items-center transition-colors duration-150 hover:bg-sidebar-accent/30",
        isCollapsed ? "justify-center px-0 py-2" : "gap-3 px-4 py-2.5",
      )}
    >
      {/*
       * Avatar — when collapsed we wrap it in the same Tooltip pattern that
       * SidebarMenuButton uses: Tooltip > TooltipTrigger asChild > element,
       * with TooltipContent hidden={!isCollapsed} so it's mounted but suppressed
       * in expanded mode.  The TooltipProvider (delayDuration={0}) is already
       * on the tree courtesy of SidebarProvider.
       */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="relative shrink-0">
            {!broken ? (
              <img
                src={avatarUrl}
                alt={username}
                className="size-9 rounded-full object-cover ring-2 ring-sidebar ring-offset-1 ring-offset-background"
                onError={() => setBroken(true)}
              />
            ) : (
              <div className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-chart-2 to-primary text-xs font-semibold text-white ring-2 ring-sidebar ring-offset-1 ring-offset-background">
                {initials}
              </div>
            )}
            {/* Always-green online dot — every player in this list is, by definition, online */}
            <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-background bg-green-500" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" align="center" hidden={!isCollapsed}>
          {username}
        </TooltipContent>
      </Tooltip>

      {/* Info — hidden when collapsed */}
      {!isCollapsed && (
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {username}
          </p>
          <p className="text-[11px] text-muted-foreground/60">
            Playing for {formatDuration(sessionMs)}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * The slide-over panel itself.  It is rendered as a fixed-position layer that
 * occupies exactly the same space as the sidebar (left: 0, width matches
 * --sidebar-width).  It slides in/out via a CSS translate on the X axis so the
 * transition is GPU-accelerated and buttery.
 *
 * - `open`  : controls the slide state
 * - `onClose`: called when the user clicks the X or presses Escape
 */
function PlayerListPanel({
  open,
  onClose,
  serverId,
}: {
  open: boolean;
  onClose: () => void;
  serverId: number;
}) {
  const { getServerPlayers } = usePlayerData();
  const { state: sidebarState } = useSidebar();
  const isCollapsed = sidebarState === "collapsed";
  // Tick every 60s so session durations update without remounting
  const now = useRelativeTick(60_000);

  const players = useMemo(
    () => getServerPlayers(serverId),
    [getServerPlayers, serverId],
  );

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  return (
    <div
      className={cn(
        "fixed inset-y-0 left-0 z-[20] flex h-full flex-col overflow-hidden bg-sidebar text-sidebar-foreground",
        "transition-transform duration-300 ease-out",
        open ? "translate-x-0" : "-translate-x-full",
        !open && "pointer-events-none",
      )}
      style={{
        width:
          sidebarState === "collapsed"
            ? "var(--sidebar-width-icon)"
            : "var(--sidebar-width)",
      }}
    >
      {/* Header row */}
      <div
        className={cn(
          "flex items-center border-b border-sidebar-border",
          isCollapsed
            ? "justify-center px-0 py-3"
            : "justify-between px-4 py-3",
        )}
      >
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <Users className="size-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">
              Online Players
            </h2>
            <span className="inline-flex items-center justify-center rounded-full bg-green-500/20 px-2 py-0.5 text-[11px] font-semibold text-green-500">
              {players.length}
            </span>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
        >
          <X className="size-4 cursor-pointer" />
        </button>
      </div>

      {/* Scrollable player list */}
      <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-sidebar-border hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/50">
        {players.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
            <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-sidebar-accent">
              <Users className="size-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No players online</p>
          </div>
        ) : (
          <div className="py-2">
            {players.map((player) => (
              <PlayerRow
                key={player.uuid}
                uuid={player.uuid}
                username={player.username}
                sessionStart={player.sessionStart}
                now={now}
                isCollapsed={isCollapsed}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ServerChat() {
  const { serverId: serverIdParam } = useParams<{ serverId: string }>();
  const serverId = serverIdParam ? parseInt(serverIdParam, 10) : null;

  const { isConnected, subscribe, unsubscribe, requestInitialData, on } =
    useWebSocket();
  const { servers } = useServerData();
  const { user } = useAuth();
  const { getPlayerByUsername } = usePlayerData();
  const isMobile = useIsMobile();

  const [messages, setMessages] = useState<CachedMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const [draft, setDraft] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [highlightedMessages, setHighlightedMessages] = useState<Set<string>>(
    new Set(),
  );

  /** Controls the player-list slide-over panel */
  const [playerListOpen, setPlayerListOpen] = useState(false);

  const isAtBottomRef = useRef(true);
  const lastMessageCountRef = useRef(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Single tick instance for the whole chat — re-renders timestamps every 60s
  // without each MessageRow running its own independent interval
  const tick = useRelativeTick();

  // Auto-expand the textarea as the user types multiline content
  useAutoResize(textareaRef, draft);

  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const atBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight <
      50;
    isAtBottomRef.current = atBottom;
    setShowScrollButton(!atBottom);
    if (atBottom) setUnreadCount(0);
  }, []);

  const server = useMemo(
    () => servers.find((s) => s.serverId === serverId),
    [servers, serverId],
  );

  const canSend = !!user && serverId !== null && !sending;

  // Sort messages chronologically, then group, and return total count
  const { groups: messageGroups, totalCount } = useMemo(() => {
    const sorted = [...messages].sort((a, b) => {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
    return {
      groups: groupMessages(sorted),
      totalCount: sorted.length,
    };
  }, [messages]);

  // ============================================================================
  // Handlers
  // ============================================================================

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  const handleScrollToBottom = useCallback(() => {
    scrollToBottom();
    setUnreadCount(0);
  }, [scrollToBottom]);

  const handleHighlightEnd = useCallback((messageIds: string[]) => {
    setHighlightedMessages((prev) => {
      const next = new Set(prev);
      for (const id of messageIds) next.delete(id);
      return next;
    });
  }, []);

  const upsertMessage = useCallback((msg: CachedMessage) => {
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.messageId === msg.messageId);
      const isNew = idx < 0;

      if (isNew && !isAtBottomRef.current) {
        setHighlightedMessages((prev) => new Set(prev).add(msg.messageId));
      }

      return idx >= 0
        ? prev.map((m, i) => (i === idx ? msg : m))
        : [...prev, msg];
    });
  }, []);

  const removeMessage = useCallback((messageId: string) => {
    setMessages((prev) => prev.filter((m) => m.messageId !== messageId));
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        setError("Only image files are allowed");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError("Image must be 10 MB or smaller");
        return;
      }
      setError(null);
      setImageFile(file);
    },
    [],
  );

  const sendMessage = useCallback(async () => {
    if (!serverId || (!draft.trim() && !imageFile)) return;

    setSending(true);
    setError(null);

    try {
      await messagesApi.send(
        {
          serverId: serverId,
          content: draft.trim() || undefined,
        },
        imageFile || undefined,
      );

      setDraft("");
      setImageFile(null);
      textareaRef.current?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  }, [serverId, draft, imageFile]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (canSend && (draft.trim() || imageFile)) sendMessage();
      }
    },
    [canSend, draft, imageFile, sendMessage],
  );

  // ============================================================================
  // Effects
  // ============================================================================

  useEffect(() => {
    if (!isConnected || serverId === null) return;
    let cancelled = false;

    async function init() {
      setLoading(true);
      const data = await requestInitialData(serverId ?? 0, {
        includeMessages: true,
        messageLimit: 100,
      });
      if (cancelled) return;
      if (data && "messages" in data) {
        setMessages(data.messages as CachedMessage[]);
      }
      await subscribe("messages" as SubscriptionType, serverId ?? 0);
      setLoading(false);
      setTimeout(() => scrollToBottom("instant"), 50);
    }

    init();
    return () => {
      cancelled = true;
      unsubscribe("messages" as SubscriptionType, serverId);
    };
  }, [
    isConnected,
    serverId,
    requestInitialData,
    subscribe,
    unsubscribe,
    scrollToBottom,
  ]);

  useEffect(() => {
    if (!isConnected || !serverId) return;

    const unsub = on("update:message", (raw) => {
      const payload = raw as {
        serverId: number;
        type: "new" | "update" | "delete";
        message?: CachedMessage;
        messageId?: string;
      };
      if (payload.serverId !== serverId) return;

      switch (payload.type) {
        case "new":
        case "update":
          if (payload.message) upsertMessage(payload.message);
          break;
        case "delete":
          if (payload.messageId) removeMessage(payload.messageId);
          break;
      }
    });

    return unsub;
  }, [isConnected, serverId, on, upsertMessage, removeMessage]);

  // Track new messages and update unread count
  useEffect(() => {
    const currentCount = totalCount;
    const previousCount = lastMessageCountRef.current;

    if (previousCount > 0 && currentCount > previousCount) {
      const newMessageCount = currentCount - previousCount;

      if (!isAtBottomRef.current) {
        setUnreadCount((prev) => prev + newMessageCount);
      } else {
        scrollToBottom();
      }
    }

    lastMessageCountRef.current = currentCount;
  }, [totalCount, scrollToBottom]);

  // ============================================================================
  // Render
  // ============================================================================

  if (!serverId) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Invalid server ID</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loading size="medium" text="Loading chat..." />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col bg-card/50 md:h-screen select-none">
      {/* Player-list slide-over — only rendered on desktop (md+) */}
      {!isMobile && serverId && (
        <PlayerListPanel
          open={playerListOpen}
          onClose={() => setPlayerListOpen(false)}
          serverId={serverId}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-sidebar px-6 py-4">
        {/* Left side: server name + status */}
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            {server?.serverName ?? `Server ${serverId}`}
          </h1>
          <p className="text-sm text-muted-foreground">
            {server?.online ? (
              <>
                <span className="mr-2 inline-block size-2 rounded-full bg-green-500"></span>
                {server.playerCount} / {server.maxPlayers} online
              </>
            ) : (
              <>
                <span className="mr-2 inline-block size-2 rounded-full bg-destructive"></span>
                Offline
              </>
            )}
          </p>
        </div>

        {/* Right side: player-list toggle + WebSocket connection status */}
        <div className="flex items-center gap-2">
          {!isMobile && (
            <button
              type="button"
              onClick={() => setPlayerListOpen((prev) => !prev)}
              className={cn(
                "flex size-9 items-center justify-center rounded-lg transition-colors cursor-pointer",
                playerListOpen
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-sidebar-accent text-muted-foreground hover:bg-sidebar-accent/80 hover:text-foreground",
              )}
              title={playerListOpen ? "Close player list" : "Show player list"}
            >
              <Users className="size-5" />
            </button>
          )}

          <div
            className={cn(
              "flex items-center gap-2 rounded-full px-3 py-1.5 text-sm",
              isConnected
                ? "bg-green-500/20 text-green-500"
                : "bg-destructive/20 text-destructive",
            )}
          >
            <span className="size-2 rounded-full bg-current"></span>
            {isConnected ? "Connected" : "Disconnected"}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="relative flex-1 overflow-hidden">
        <div
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="h-full overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/50"
        >
          {messageGroups.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-sidebar-accent">
                  <span className="text-2xl">💬</span>
                </div>
                <p className="text-muted-foreground">No messages yet</p>
                <p className="mt-1 text-sm text-muted-foreground/60">
                  Be the first to send a message!
                </p>
              </div>
            </div>
          ) : (
            <div className="py-2">
              {(() => {
                const groupHighlights = messageGroups.map((g) =>
                  groupHasHighlight(g, highlightedMessages),
                );
                return messageGroups.map((group, idx) => {
                  let isOnline: boolean | undefined;
                  if (group.source === MessageSource.MINECRAFT && serverId) {
                    const player = getPlayerByUsername(group.displayName);
                    isOnline = player?.serverId === serverId ? true : false;
                  }

                  const isHighlighted = groupHighlights[idx];
                  const prevGroup =
                    idx > 0 ? messageGroups[idx - 1] : undefined;

                  return (
                    <MessageGroupComponent
                      key={`${group.key}-${group.messages[0]?.messageId}`}
                      group={group}
                      prevSource={prevGroup?.source}
                      tick={tick}
                      onImageLoad={() => {
                        if (isAtBottomRef.current) scrollToBottom();
                      }}
                      isOnline={isOnline}
                      hasHighlight={isHighlighted}
                      onHighlightEnd={handleHighlightEnd}
                    />
                  );
                });
              })()}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Scroll-to-bottom — single consolidated button */}
        {showScrollButton && (
          <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2">
            <button
              type="button"
              onClick={handleScrollToBottom}
              className={cn(
                "pointer-events-auto flex items-center justify-center shadow-lg transition-all duration-150 cursor-pointer",
                unreadCount > 0
                  ? "gap-2 rounded-full bg-primary px-3.5 py-1.5 text-primary-foreground hover:bg-primary/90"
                  : "size-9 rounded-full bg-card ring-1 ring-border hover:bg-sidebar-accent",
              )}
            >
              {unreadCount > 0 && (
                <span className="inline-flex size-4.5 items-center justify-center rounded-full bg-white/20 text-[11px] font-semibold">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
              {unreadCount > 0 && (
                <span className="text-xs font-medium">New messages</span>
              )}
              <ChevronDown
                className={cn(
                  unreadCount > 0 ? "size-3.5" : "size-5 text-foreground",
                )}
              />
            </button>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-border bg-sidebar p-4">
        {imageFile && (
          <div className="mb-3">
            <ImagePreview
              file={imageFile}
              onRemove={() => setImageFile(null)}
            />
          </div>
        )}

        {error && (
          <div className="mb-3 rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={!canSend}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent text-muted-foreground transition-colors hover:bg-sidebar-accent/80 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
          >
            <Paperclip className="size-5" />
          </button>

          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!canSend}
            placeholder={user ? "Type a message..." : "Log in to send messages"}
            rows={1}
            className="flex-1 resize-none rounded-lg border border-border bg-sidebar-accent px-4 py-2.5 text-sm text-foreground placeholder-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-40 leading-[1.5] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/50"
          />

          <button
            type="button"
            onClick={sendMessage}
            disabled={!canSend || (!draft.trim() && !imageFile)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
          >
            {sending ? (
              <div className="size-5 animate-spin rounded-full border-2 border-white/20 border-t-white"></div>
            ) : (
              <Send className="size-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
