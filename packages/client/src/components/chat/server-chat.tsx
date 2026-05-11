import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useParams } from "react-router-dom";
import { ChevronDown, Paperclip, Send, Users } from "lucide-react";
import type {
  CachedMessage,
  SubscriptionType,
} from "@createrington/shared/socket";
import { MessageSource } from "@createrington/shared/socket";
import { useWebSocket } from "@/contexts/websocket";
import { useServerData } from "@/contexts/server-data";
import { usePlayerData } from "@/contexts/player-data";
import { useAuth } from "@/contexts/auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { messagesApi } from "@/services/api/user/messages";
import { Loading } from "../loading-spinner";
import { ImagePreview } from "./image-preview";
import { MessageGroupComponent } from "./message-group";
import { PlayerListPanel } from "./player-list-panel";
import { useAutoResize, useRelativeTick } from "./hooks";
import { groupHasHighlight, groupMessages } from "./utils";

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

  // Single tick instance for the whole chat: re-renders timestamps every 60s
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
    }

    init();
    return () => {
      cancelled = true;
      unsubscribe("messages" as SubscriptionType, serverId);
    };
  }, [isConnected, serverId, requestInitialData, subscribe, unsubscribe]);

  // Pin the scroll to the bottom on the first render after loading resolves.
  // useLayoutEffect runs synchronously after DOM mutations but before the
  // browser paints, so the user never sees the messages at scrollTop=0 before
  // a delayed scroll jumps them down. (The previous setTimeout-based approach
  // caused a visible top→bottom flicker on route entry.)
  useLayoutEffect(() => {
    if (loading) return;
    const el = messagesContainerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [loading]);

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

  if (!serverId) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Invalid server ID</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-var(--mobile-nav-height))] flex-col bg-card/50 select-none">
      {/* Player-list slide-over: only rendered on desktop (md+) */}
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
              loading
                ? "bg-muted/40 text-muted-foreground"
                : isConnected
                  ? "bg-green-500/20 text-green-500"
                  : "bg-destructive/20 text-destructive",
            )}
          >
            <span
              className={cn(
                "size-2 rounded-full bg-current",
                loading && "animate-pulse",
              )}
            />
            {loading
              ? "Connecting..."
              : isConnected
                ? "Connected"
                : "Disconnected"}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="h-full overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/50"
        >
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <Loading size="medium" text="Loading chat..." />
            </div>
          ) : messageGroups.length === 0 ? (
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

        {/* Scroll-to-bottom: single consolidated button */}
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
