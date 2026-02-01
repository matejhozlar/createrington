import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useWebSocket, useServerData } from "@/contexts/socket";
import { useAuth } from "@/contexts/auth";
import type {
  CachedMessage,
  SubscriptionType,
} from "@createrington/shared/socket";
import type {
  MessageErrorResponse,
  SendMessageResponse,
} from "@createrington/shared/api";
import { MessageSource } from "@createrington/shared/socket";
import { Loading } from "@/components/Loading";
import { Send, Paperclip, X, Maximize2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// ============================================================================
// Types & Helpers
// ============================================================================

interface SourceConfig {
  label: string;
  color: string;
  bgColor: string;
  accentColor: string; // used for embed border, avatar ring tint, etc.
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
    color: "text-sidebar-primary",
    bgColor: "bg-sidebar-primary/10",
    accentColor: "hsl(var(--sidebar-primary))",
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

function useRelativeTick(intervalMs = 60_000) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return tick;
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

    // Lock overflow while we collapse — prevents the browser from latching
    // a scrollbar during the momentary "auto" measurement step.
    el.style.overflow = "hidden";
    el.style.height = "auto";

    const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 20;
    const paddingY =
      parseFloat(getComputedStyle(el).paddingTop) +
      parseFloat(getComputedStyle(el).paddingBottom);
    const maxHeight = lineHeight * maxRows + paddingY;
    const capped = el.scrollHeight >= maxHeight;

    el.style.height = (capped ? maxHeight : el.scrollHeight) + "px";
    // Only allow scrolling when content actually exceeds the cap;
    // otherwise keep it hidden so the scrollbar never appears.
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
  key: string; // authorId + source for grouping
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

/**
 * A single reusable markdown renderer that accepts a `variant` prop
 * to control sizing and color intent — eliminates the 3× duplication
 * of component overrides that existed before.
 */
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
    <div className="prose prose-sm dark:prose-invert max-w-none break-words leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => (
            <p
              className={cn(
                "my-0.5",
                isTitle
                  ? "text-sm font-semibold text-sidebar-primary"
                  : isEmbed
                    ? "text-sm text-muted-foreground"
                    : "text-sm text-foreground",
              )}
            >
              {children}
            </p>
          ),
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "hover:underline",
                isTitle
                  ? "text-sidebar-primary font-semibold"
                  : "text-sidebar-primary",
              )}
            >
              {children}
            </a>
          ),
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
                    ? "bg-sidebar-accent px-1.5 py-0.5 text-xs text-sidebar-primary font-semibold"
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
                "my-1.5 border-l-2 border-sidebar-primary pl-3 italic",
                isEmbed
                  ? "border-sidebar-primary/50 pl-2 text-xs text-muted-foreground/80"
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
                  ? "text-sidebar-primary"
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
                  ? "text-sidebar-primary font-semibold"
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
        {children}
      </ReactMarkdown>
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function Avatar({ url, name }: { url?: string; name: string }) {
  const [broken, setBroken] = useState(false);
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="shrink-0">
      {url && !broken ? (
        <img
          src={url}
          alt={name}
          className="size-9 rounded-full object-cover ring-2 ring-sidebar ring-offset-1 ring-offset-background"
          onError={() => setBroken(true)}
        />
      ) : (
        <div className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-sidebar-primary to-chart-4 text-xs font-semibold text-white ring-2 ring-sidebar ring-offset-1 ring-offset-background">
          {initials}
        </div>
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

// Single image tile used inside the grid layout
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

/**
 * Adaptive image grid:
 *   1 image  → full width, natural aspect ratio capped at max-h-64
 *   2 images → side by side, equal height
 *   3+ images → 2-col grid, first image spans both rows (tall), rest fill in
 */
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

  // 3+ images: first image is tall on the left, the rest stack on the right
  const [first, ...rest] = attachments;
  return (
    <div
      className="mt-2 grid max-w-sm grid-cols-2 grid-rows-2 gap-1.5"
      style={{ height: "18rem" }}
    >
      {/* First image spans both rows */}
      <ImageTile
        url={first.url}
        alt={first.filename}
        onLoad={onLoad}
        onFullscreen={() => onFullscreen(first.url, first.filename)}
        className="row-span-2"
      />
      {/* Remaining images fill the right column; extras get a "+N" overlay on the last visible slot */}
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
        <X className="size-6 text-foreground" />
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

// A single message row inside a group (no avatar, no name header — those live on the group)
function MessageRow({
  message,
  isFirst,
  tick,
  isHighlighted,
  onImageLoad,
}: {
  message: CachedMessage;
  isFirst: boolean;
  tick: number;
  isHighlighted: boolean;
  onImageLoad?: () => void;
}) {
  // tick is read here so this component re-renders when it ticks, keeping formatTime fresh
  void tick;

  const [fullscreenImage, setFullscreenImage] = useState<{
    url: string;
    alt: string;
  } | null>(null);

  const imageAttachments = message.attachments.filter((a) =>
    a.contentType?.startsWith("image/"),
  );

  // An image-only message (no text, no embeds) that isn't the first in its group
  // needs its own visible timestamp — the group header timestamp is too far away
  // to feel anchored to this specific message.
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
          isHighlighted && "animate-highlight-fade",
        )}
      >
        {/* Hover timestamp — non-first messages that have text content */}
        {!isFirst && !isImageOnly && (
          <span className="absolute right-0 top-0 opacity-0 text-[11px] text-muted-foreground/60 transition-opacity duration-150 group-hover:opacity-100">
            {formatTime(message.createdAt)}
            {message.editedAt && (
              <span className="ml-1 opacity-60">(edited)</span>
            )}
          </span>
        )}

        {/* Content */}
        {message.content && (
          <ChatMarkdown variant="body">{message.content}</ChatMarkdown>
        )}

        {/* Images — adaptive grid layout */}
        {imageAttachments.length > 0 && (
          <MessageImageGrid
            attachments={imageAttachments}
            onLoad={onImageLoad}
            onFullscreen={(url, alt) => setFullscreenImage({ url, alt })}
          />
        )}

        {/* Inline timestamp for image-only rows — always visible, sits beneath the grid */}
        {needsInlineTimestamp && (
          <span className="mt-1 block text-[11px] text-muted-foreground/50">
            {formatTime(message.createdAt)}
            {message.editedAt && (
              <span className="ml-1 opacity-60">(edited)</span>
            )}
          </span>
        )}

        {/* Embeds */}
        {message.embeds.map((embed, i) => (
          <div
            key={i}
            className="mt-2 rounded-lg border border-border bg-card/60 p-3"
            style={{
              borderLeftWidth: "3px",
              borderLeftColor:
                embed.color !== undefined
                  ? `#${embed.color.toString(16).padStart(6, "0")}`
                  : "var(--sidebar-primary)",
            }}
          >
            {embed.title && (
              <ChatMarkdown variant="embed-title">{embed.title}</ChatMarkdown>
            )}
            {embed.description && (
              <div className={embed.title ? "mt-1" : ""}>
                <ChatMarkdown variant="embed-body">
                  {embed.description}
                </ChatMarkdown>
              </div>
            )}
          </div>
        ))}
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

// A group of consecutive messages from the same author
function MessageGroup({
  group,
  prevSource,
  tick,
  highlightedMessages,
  onImageLoad,
}: {
  group: MessageGroup;
  prevSource?: MessageSource;
  tick: number;
  highlightedMessages: Set<string>;
  onImageLoad?: () => void;
}) {
  const config = SOURCE_CONFIG[group.source];
  const showDivider = prevSource !== undefined && prevSource !== group.source;

  return (
    <>
      {/* Source-change divider: a thin colored line with the new source label */}
      {showDivider && (
        <div className="flex items-center gap-3 px-4 py-2">
          <div className={cn("h-px flex-1 bg-border")} />
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider border",
              group.source === MessageSource.DISCORD &&
                "border-sidebar-primary/30 bg-sidebar-primary/10 text-sidebar-primary",
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

      <div className="group/msg-group flex gap-3 px-4 py-2.5 transition-colors duration-150 hover:bg-sidebar-accent/20">
        {/* Avatar — pinned to top of group */}
        <div className="shrink-0 pt-0.5">
          <Avatar url={group.avatarUrl} name={group.displayName} />
        </div>

        {/* Content column */}
        <div className="min-w-0 flex-1">
          {/* Header row: name + source badge + bot tag + timestamp */}
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

            {/* Group timestamp — always visible, anchored to the first message */}
            <span className="ml-auto text-[11px] text-muted-foreground/50">
              {formatTime(group.messages[0]?.createdAt)}
            </span>
          </div>

          {/* All messages in this group */}
          {group.messages.map((msg, i) => (
            <MessageRow
              key={msg.messageId}
              message={msg}
              isFirst={i === 0}
              tick={tick}
              isHighlighted={highlightedMessages.has(msg.messageId)}
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
        <X className="size-3 text-white" />
      </button>
      <div className="absolute bottom-1 left-1 rounded bg-background/80 px-1.5 py-0.5 text-xs text-foreground backdrop-blur-sm">
        {(file.size / 1024 / 1024).toFixed(1)}MB
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

    // Clear highlights after scrolling and a brief delay
    setTimeout(() => {
      setHighlightedMessages(new Set());
    }, 2000);
  }, [scrollToBottom]);

  const upsertMessage = useCallback((msg: CachedMessage) => {
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.messageId === msg.messageId);
      const isNew = idx < 0;

      // If it's a new message and we're not at bottom, it should be highlighted
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

    const token = localStorage.getItem("auth_token");
    if (!token) {
      setError("You must be logged in to send messages");
      return;
    }

    setSending(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("serverId", String(serverId));
      if (draft.trim()) formData.append("content", draft.trim());
      if (imageFile) formData.append("image", imageFile);

      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const body = (await response.json()) as
        | SendMessageResponse
        | MessageErrorResponse;

      if (!body.success) {
        throw new Error(
          body.error?.message ??
            `Request failed with status ${response.status}`,
        );
      }

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
        messageLimit: 50,
      });
      if (cancelled) return;
      if (data && "messages" in data) {
        setMessages(data.messages as CachedMessage[]);
        setTimeout(() => scrollToBottom("instant"), 100);
      }
      await subscribe("messages" as SubscriptionType, serverId ?? 0);
      setLoading(false);
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

    // Only increment unread if there are actually new messages
    if (previousCount > 0 && currentCount > previousCount) {
      const newMessageCount = currentCount - previousCount;

      if (!isAtBottomRef.current) {
        setUnreadCount((prev) => prev + newMessageCount);
      } else {
        // If at bottom, auto-scroll but clear any highlights after a delay
        scrollToBottom();
        setTimeout(() => {
          setHighlightedMessages(new Set());
        }, 2000);
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
    <div className="flex h-[calc(100vh-3.5rem)] flex-col bg-card/50 md:h-screen">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-sidebar px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            {server?.serverName ?? `Server ${serverId}`}
          </h1>
          <p className="text-sm text-muted-foreground">
            {server?.online ? (
              <>
                <span className="mr-2 inline-block size-2 rounded-full bg-chart-2"></span>
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

        <div
          className={cn(
            "flex items-center gap-2 rounded-full px-3 py-1.5 text-sm",
            isConnected
              ? "bg-chart-2/20 text-chart-2"
              : "bg-destructive/20 text-destructive",
          )}
        >
          <span className="size-2 rounded-full bg-current"></span>
          {isConnected ? "Connected" : "Disconnected"}
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
              {messageGroups.map((group, idx) => (
                <MessageGroup
                  key={`${group.key}-${group.messages[0]?.messageId}`}
                  group={group}
                  prevSource={
                    idx > 0 ? messageGroups[idx - 1].source : undefined
                  }
                  tick={tick}
                  highlightedMessages={highlightedMessages}
                  onImageLoad={() => {
                    if (isAtBottomRef.current) scrollToBottom();
                  }}
                />
              ))}
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
                  ? "gap-2 rounded-full bg-sidebar-primary px-3.5 py-1.5 text-white hover:bg-sidebar-primary/90"
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
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-white transition-colors hover:bg-sidebar-primary/90 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
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
