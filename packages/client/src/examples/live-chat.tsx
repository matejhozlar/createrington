/**
 * LiveChat.tsx — Example component demonstrating how to:
 *   1. Subscribe to per-server message streams via the WebSocket context
 *   2. Fetch initial message history via requestInitialData
 *   3. Handle real-time message create / update / delete events
 *   4. Differentiate messages visually by source (system / discord / minecraft / web)
 *   5. Display per-server online status pulled from ServerDataContext
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWebSocket, useServerData } from "@/contexts/socket";

// ---------------------------------------------------------------------------
// Re-export the shared types here so the file stays self-documenting.
// In production you'd just import from "@createrington/shared".
// ---------------------------------------------------------------------------
import type { CachedMessage, SubscriptionType } from "@createrington/shared";
import { MessageSource } from "@createrington/shared";

// MessageSource is an enum on the shared package; mirroring it here for clarity.
// enum MessageSource {
//   SYSTEM = "system",
//   DISCORD = "discord",
//   MINECRAFT = "minecraft",
//   WEB = "web",
// }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format a Date / date-string into a short HH:MM display */
function formatTime(raw: Date | string | undefined): string {
  if (!raw) return "";
  const d = raw instanceof Date ? raw : new Date(raw);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** Hex colour number → CSS hex string */
function embedColorToCss(color: number | string | undefined): string | null {
  if (color === undefined || color === null) return null;
  if (typeof color === "string") return color;
  // Discord embed colours are 24-bit integers
  return "#" + color.toString(16).padStart(6, "0");
}

// ---------------------------------------------------------------------------
// Source badge & styling config — single source of truth for how each
// MessageSource is rendered.  Extend or tweak as needed.
// ---------------------------------------------------------------------------

interface SourceStyle {
  /** Label shown in the badge */
  label: string;
  /** Tailwind classes for the badge pill */
  badgeClass: string;
  /** Tailwind classes for the left border accent on the message row */
  borderClass: string;
  /** Tailwind classes for the background tint of the row */
  bgClass: string;
}

const SOURCE_STYLES: Record<MessageSource, SourceStyle> = {
  [MessageSource.SYSTEM]: {
    label: "System",
    badgeClass: "bg-gray-500 text-gray-100",
    borderClass: "border-l-gray-400",
    bgClass: "bg-gray-900/40",
  },
  [MessageSource.DISCORD]: {
    label: "Discord",
    badgeClass: "bg-indigo-600 text-indigo-100",
    borderClass: "border-l-indigo-500",
    bgClass: "bg-indigo-950/30",
  },
  [MessageSource.MINECRAFT]: {
    label: "Minecraft",
    badgeClass: "bg-emerald-600 text-emerald-100",
    borderClass: "border-l-emerald-500",
    bgClass: "bg-emerald-950/30",
  },
  [MessageSource.WEB]: {
    label: "Web",
    badgeClass: "bg-amber-600 text-amber-100",
    borderClass: "border-l-amber-500",
    bgClass: "bg-amber-950/30",
  },
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Small coloured pill that identifies the message source */
function SourceBadge({ source }: { source: MessageSource }) {
  const style = SOURCE_STYLES[source] ?? SOURCE_STYLES[MessageSource.SYSTEM];
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold leading-tight ${style.badgeClass}`}
    >
      {style.label}
    </span>
  );
}

/** Avatar: uses the provided URL when available, falls back to initials.
 *  onError catches any failed load (expired CDN link, 404, CORS block, etc.)
 *  and flips to the initials circle.  The broken flag resets whenever the
 *  url prop itself changes so a new valid URL is given a fair chance. */
function Avatar({ url, name }: { url?: string; name: string }) {
  // Track which specific URL failed rather than a boolean that needs resetting.
  // When `url` changes, `broken` naturally becomes false without an effect.
  const [brokenUrl, setBrokenUrl] = useState<string | undefined>(undefined);
  const broken = brokenUrl === url;

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
          className="h-8 w-8 rounded-full object-cover"
          onError={() => setBrokenUrl(url)}
        />
      ) : (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-700 text-xs font-bold text-gray-200">
          {initials}
        </div>
      )}
    </div>
  );
}

/** Renders a single embed (title, description, fields, footer) */
function EmbedRenderer({ embed }: { embed: CachedMessage["embeds"][0] }) {
  const borderColor = embedColorToCss(embed.color) ?? "#4f46e5";

  return (
    <div
      className="mt-1.5 rounded-r-md border-l-4 bg-gray-800/60 px-3 py-2.5 text-sm"
      style={{ borderLeftColor: borderColor }}
    >
      {embed.author && (
        <div className="mb-1 flex items-center gap-1.5">
          {embed.author.iconUrl && (
            <img
              src={embed.author.iconUrl}
              alt=""
              className="h-4 w-4 rounded-full"
            />
          )}
          <span className="text-xs font-semibold text-gray-300">
            {embed.author.name}
          </span>
        </div>
      )}

      {embed.title && (
        <div className="font-semibold text-indigo-300">{embed.title}</div>
      )}
      {embed.description && (
        <div className="mt-0.5 text-gray-300">{embed.description}</div>
      )}

      {embed.fields && embed.fields.length > 0 && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          {embed.fields.map((field, i) => (
            <div key={i} className={field.inline ? "" : "col-span-2"}>
              <div className="text-xs font-semibold text-gray-400">
                {field.name}
              </div>
              <div className="text-xs text-gray-300">{field.value}</div>
            </div>
          ))}
        </div>
      )}

      {embed.footer && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-500">
          {embed.footer.iconUrl && (
            <img
              src={embed.footer.iconUrl}
              alt=""
              className="h-3 w-3 rounded-full"
            />
          )}
          <span>{embed.footer.text}</span>
          {embed.timestamp && (
            <span className="ml-auto">{formatTime(embed.timestamp)}</span>
          )}
        </div>
      )}
    </div>
  );
}

/** Renders image attachments inline */
function AttachmentImages({
  attachments,
}: {
  attachments: CachedMessage["attachments"];
}) {
  const images = attachments.filter((a) => a.contentType?.startsWith("image/"));
  if (images.length === 0) return null;

  return (
    <div className="mt-1.5 flex flex-wrap gap-2">
      {images.map((img, i) => (
        <a key={i} href={img.url} target="_blank" rel="noreferrer">
          <img
            src={img.url}
            alt={img.filename}
            className="max-h-48 rounded-md object-contain"
          />
        </a>
      ))}
    </div>
  );
}

/** Non-image attachments as download links */
function AttachmentFiles({
  attachments,
}: {
  attachments: CachedMessage["attachments"];
}) {
  const files = attachments.filter((a) => !a.contentType?.startsWith("image/"));
  if (files.length === 0) return null;

  return (
    <div className="mt-1.5 flex flex-wrap gap-2">
      {files.map((file, i) => (
        <a
          key={i}
          href={file.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md bg-gray-800 px-2.5 py-1 text-xs text-indigo-300 transition-colors hover:bg-gray-700"
        >
          📎 {file.filename}
          {file.size && (
            <span className="text-gray-500">
              ({(file.size / 1024).toFixed(1)} KB)
            </span>
          )}
        </a>
      ))}
    </div>
  );
}

/** Collapsible raw JSON inspector — shows the full CachedMessage payload
 *  for whichever message is currently selected in the chat list. */
function RawInspector({
  message,
  open,
  onToggle,
}: {
  message: CachedMessage | null;
  open: boolean;
  onToggle: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!message) return;
    navigator.clipboard.writeText(JSON.stringify(message, null, 2)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="border-t border-gray-700">
      {/* toggle header */}
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2 bg-gray-800/60 px-4 py-2 text-left text-xs text-gray-400 transition-colors hover:bg-gray-800"
      >
        <span className="select-none">{open ? "▼" : "▶"}</span>
        <span className="font-semibold">Raw Message</span>
        {message && (
          <span className="text-gray-600">— {message.messageId}</span>
        )}
        {!message && (
          <span className="text-gray-600">— click a message to inspect</span>
        )}
      </button>

      {/* body */}
      {open && (
        <div className="flex flex-col bg-gray-950">
          {/* copy button row */}
          <div className="flex items-center justify-end border-b border-gray-800 px-3 py-1">
            <button
              onClick={handleCopy}
              disabled={!message}
              className="rounded px-2 py-0.5 text-xs text-gray-400 transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-30"
            >
              {copied ? "✓ Copied" : "Copy JSON"}
            </button>
          </div>

          {/* JSON output */}
          <pre className="max-h-56 overflow-auto p-3 text-xs leading-relaxed text-gray-300">
            {message
              ? JSON.stringify(message, null, 2)
              : "// select a message above to see its raw payload"}
          </pre>
        </div>
      )}
    </div>
  );
}

/** A single message row, fully differentiated by source */
function MessageRow({
  message,
  isSelected,
  onSelect,
}: {
  message: CachedMessage;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const source = (message.source as MessageSource) ?? MessageSource.DISCORD;
  const style = SOURCE_STYLES[source] ?? SOURCE_STYLES[MessageSource.DISCORD];

  // Derive the display name depending on source
  let displayName = message.authorDisplayname || message.authorUsername;
  if (source === MessageSource.MINECRAFT && message.minecraftData) {
    displayName = message.minecraftData.playerName;
  }
  if (source === MessageSource.WEB && message.webData) {
    displayName = message.webData.originalAuthor.displayName;
  }

  // For system messages, use a simplified layout
  if (source === MessageSource.SYSTEM) {
    return (
      <div
        onClick={onSelect}
        className={`cursor-pointer border-l-4 ${style.borderClass} ${style.bgClass} px-3 py-2 ${isSelected ? "ring-1 ring-inset ring-gray-500" : ""}`}
      >
        <div className="flex items-center gap-2">
          <SourceBadge source={source} />
          {message.systemData?.title && (
            <span className="text-sm font-semibold text-gray-200">
              {message.systemData.title}
            </span>
          )}
          <span className="ml-auto text-xs text-gray-500">
            {formatTime(message.createdAt)}
          </span>
        </div>
        <p className="mt-0.5 text-sm text-gray-400">
          {message.systemData?.description ?? message.content}
        </p>
      </div>
    );
  }

  // Standard message layout (discord / minecraft / web)
  return (
    <div
      onClick={onSelect}
      className={`cursor-pointer border-l-4 ${style.borderClass} ${style.bgClass} px-3 py-2 transition-colors hover:brightness-110 ${isSelected ? "ring-1 ring-inset ring-gray-500" : ""}`}
    >
      {/* Header row: avatar + name + badge + time */}
      <div className="flex items-center gap-2.5">
        <Avatar
          url={
            source === MessageSource.WEB && message.webData
              ? message.webData.originalAuthor.avatarUrl
              : message.authorAvatarUrl
          }
          name={displayName}
        />

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="truncate text-sm font-semibold text-gray-100">
            {displayName}
          </span>
          <SourceBadge source={source} />
          {message.isBot && source !== MessageSource.MINECRAFT && (
            <span className="rounded bg-indigo-900/60 px-1.5 py-0.5 text-xs text-indigo-300">
              BOT
            </span>
          )}
          <span className="ml-auto text-xs text-gray-500">
            {formatTime(message.createdAt)}
            {message.editedAt && (
              <span className="ml-1 text-gray-600">(edited)</span>
            )}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="ml-10.5 mt-0.5">
        {/* Reply reference */}
        {message.referenceMessageId && (
          <div className="mb-1 text-xs text-gray-500">
            ↩ replying to{" "}
            <code className="text-gray-400">{message.referenceMessageId}</code>
          </div>
        )}

        {/* Content */}
        {message.content && (
          <p className="text-sm text-gray-200">{message.content}</p>
        )}

        {/* Attachments */}
        <AttachmentImages attachments={message.attachments} />
        <AttachmentFiles attachments={message.attachments} />

        {/* Embeds */}
        {message.embeds.map((embed, i) => (
          <EmbedRenderer key={i} embed={embed} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Server selector tab bar
// ---------------------------------------------------------------------------

interface ServerTab {
  serverId: number;
  name: string;
  online: boolean;
  playerCount: number;
}

function ServerTabs({
  tabs,
  activeId,
  onSelect,
}: {
  tabs: ServerTab[];
  activeId: number;
  onSelect: (id: number) => void;
}) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-gray-700 pb-2">
      {tabs.map((tab) => {
        const isActive = tab.serverId === activeId;
        return (
          <button
            key={tab.serverId}
            onClick={() => onSelect(tab.serverId)}
            className={[
              "flex shrink-0 items-center gap-2 rounded-t-md px-3.5 py-1.5 text-sm transition-colors",
              isActive
                ? "bg-gray-800 text-white"
                : "text-gray-400 hover:bg-gray-800/50 hover:text-gray-200",
            ].join(" ")}
          >
            {/* Online indicator dot */}
            <span
              className={[
                "h-2 w-2 rounded-full",
                tab.online ? "bg-emerald-400" : "bg-gray-600",
              ].join(" ")}
            />
            <span>{tab.name}</span>
            {tab.online && (
              <span className="text-xs text-gray-500">{tab.playerCount}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main LiveChat component
// ---------------------------------------------------------------------------

export function LiveChat() {
  // --- context hooks --------------------------------------------------------
  const { isConnected, subscribe, unsubscribe, requestInitialData, on } =
    useWebSocket();
  const { servers } = useServerData();

  // --- local state ----------------------------------------------------------
  // Map: serverId → ordered array of messages (oldest first)
  const [messagesByServer, setMessagesByServer] = useState<
    Record<number, CachedMessage[]>
  >({});
  const [activeServerId, setActiveServerId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Raw inspector state
  const [selectedMessage, setSelectedMessage] = useState<CachedMessage | null>(
    null,
  );
  const [inspectorOpen, setInspectorOpen] = useState(true);

  // Scroll anchor
  const bottomRef = useRef<HTMLDivElement>(null);

  // --- derived --------------------------------------------------------------
  const serverTabs: ServerTab[] = useMemo(
    () =>
      servers.map((s) => ({
        serverId: s.serverId,
        name: s.serverName,
        online: s.online,
        playerCount: s.playerCount,
      })),
    [servers],
  );

  const activeMessages = useMemo(
    () =>
      activeServerId !== null ? (messagesByServer[activeServerId] ?? []) : [],
    [activeServerId, messagesByServer],
  );

  // --- helpers --------------------------------------------------------------

  /** Upsert a message into the per-server list (handles create + update) */
  const upsertMessage = useCallback((msg: CachedMessage) => {
    setMessagesByServer((prev) => {
      const list = prev[msg.serverId] ?? [];
      const idx = list.findIndex((m) => m.messageId === msg.messageId);
      const updated =
        idx >= 0 ? list.map((m, i) => (i === idx ? msg : m)) : [...list, msg];
      return { ...prev, [msg.serverId]: updated };
    });
  }, []);

  /** Remove a message by ID from a server's list */
  const removeMessage = useCallback((serverId: number, messageId: string) => {
    setMessagesByServer((prev) => {
      const list = prev[serverId] ?? [];
      return {
        ...prev,
        [serverId]: list.filter((m) => m.messageId !== messageId),
      };
    });
  }, []);

  // --- lifecycle ------------------------------------------------------------

  // 1. When connected: pick the first server as active, fetch initial data,
  //    and subscribe to message streams for every server.
  useEffect(() => {
    if (!isConnected || servers.length === 0) return;

    let cancelled = false;

    async function init() {
      setLoading(true);

      // Default to the first server if none selected
      if (activeServerId === null) {
        setActiveServerId(servers[0].serverId);
      }

      // Request initial data for ALL servers (includes message history)
      // You could also call requestInitialData(serverId) per-server if you
      // want lazy loading when the user switches tabs.
      const data = await requestInitialData(undefined, {
        includeMessages: true,
        messageLimit: 50,
      });

      if (cancelled) return;

      if (data && "messages" in data) {
        // data.messages is Record<number, CachedMessage[]>
        setMessagesByServer(data.messages as Record<number, CachedMessage[]>);
      }

      // Subscribe to the "messages" stream for every known server.
      // This ensures we receive real-time updates regardless of which
      // tab is currently active.
      for (const server of servers) {
        await subscribe("messages" as SubscriptionType, server.serverId);
      }

      setLoading(false);
    }

    init();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, servers]);

  // 2. Listen for real-time message events emitted by the server.
  //    The WebSocketService broadcasts on SocketEvent.UPDATE_MESSAGE
  //    which maps to "update:message" on the client event bus.
  useEffect(() => {
    if (!isConnected) return;

    const unsub = on("update:message", (raw) => {
      // The server emits a MessageUpdatePayload:
      //   { serverId, type: "new"|"update"|"delete", message?, messageId?, timestamp }
      const payload = raw as {
        serverId: number;
        type: "new" | "update" | "delete";
        message?: CachedMessage;
        messageId?: string;
      };

      switch (payload.type) {
        case "new":
        case "update":
          if (payload.message) {
            upsertMessage(payload.message);
          }
          break;
        case "delete":
          if (payload.messageId) {
            removeMessage(payload.serverId, payload.messageId);
          }
          break;
      }
    });

    return unsub;
  }, [isConnected, on, upsertMessage, removeMessage]);

  // 3. Cleanup: unsubscribe from all servers on unmount.
  useEffect(() => {
    return () => {
      servers.forEach((s) => {
        unsubscribe("messages" as SubscriptionType, s.serverId);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 4. Auto-scroll to the bottom whenever messages change for the active server.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeMessages]);

  // --- render ---------------------------------------------------------------

  if (loading || servers.length === 0) {
    return (
      <div className="flex h-96 items-center justify-center text-sm text-gray-500">
        {isConnected
          ? "Loading messages…"
          : "Waiting for WebSocket connection…"}
      </div>
    );
  }

  const activeServer = servers.find((s) => s.serverId === activeServerId);

  return (
    <div className="flex h-[600px] flex-col rounded-lg border border-gray-700 bg-gray-900 text-gray-100">
      {/* --- top bar: connection indicator + active server status --- */}
      <div className="flex items-center justify-between border-b border-gray-700 px-4 py-2">
        <div className="flex items-center gap-2">
          <span
            className={[
              "h-2.5 w-2.5 rounded-full",
              isConnected ? "bg-emerald-400" : "bg-red-500",
            ].join(" ")}
          />
          <span className="text-xs text-gray-400">
            {isConnected ? "Connected" : "Disconnected"}
          </span>
        </div>

        {activeServer && (
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span
              className={[
                "rounded-full px-2 py-0.5 font-medium",
                activeServer.online
                  ? "bg-emerald-900/50 text-emerald-300"
                  : "bg-gray-800 text-gray-500",
              ].join(" ")}
            >
              {activeServer.online ? "● Online" : "○ Offline"}
            </span>
            <span>
              {activeServer.playerCount} / {activeServer.maxPlayers} players
            </span>
          </div>
        )}
      </div>

      {/* --- server tab bar --- */}
      <div className="px-3 pt-2">
        <ServerTabs
          tabs={serverTabs}
          activeId={activeServerId!}
          onSelect={(id) => {
            setActiveServerId(id);
            setSelectedMessage(null);
          }}
        />
      </div>

      {/* --- message list (scrollable) --- */}
      <div className="flex-1 overflow-y-auto">
        {activeMessages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-gray-600">
            No messages yet for this server.
          </div>
        ) : (
          <div className="flex flex-col gap-0.5 p-2">
            {activeMessages.map((msg) => (
              <MessageRow
                key={msg.messageId}
                message={msg}
                isSelected={selectedMessage?.messageId === msg.messageId}
                onSelect={() => setSelectedMessage(msg)}
              />
            ))}
            {/* scroll anchor */}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* --- legend (source key) --- */}
      <div className="flex flex-wrap items-center gap-3 border-t border-gray-700 px-4 py-2">
        {Object.values(MessageSource).map((src) => (
          <SourceBadge key={src} source={src} />
        ))}
      </div>

      {/* --- raw JSON inspector --- */}
      <RawInspector
        message={selectedMessage}
        open={inspectorOpen}
        onToggle={() => setInspectorOpen((o) => !o)}
      />
    </div>
  );
}
