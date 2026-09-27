import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Navigate, useParams } from "react-router";
import { ChevronDown, Users } from "lucide-react";
import type {
  CachedMessage,
  SubscriptionType,
} from "@createrington/shared/socket";
import { MessageSource } from "@createrington/shared/socket";
import { useWebSocket } from "@/contexts/websocket";
import { useServerData } from "@/contexts/server-data";
import { usePlayerData } from "@/contexts/player-data";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Loading } from "../loading-spinner";
import { ChatComposer } from "./chat-composer";
import { ChatFallback } from "./chat-fallback";
import { MessageGroupComponent } from "./message-group";
import { PlayerListPanel } from "./player-list-panel";
import { useRelativeTick } from "./hooks";
import { groupHasHighlight, groupMessages } from "./utils";

const MAX_MESSAGES = 200;

export function ServerChat() {
  const { serverSlug } = useParams<{ serverSlug: string }>();

  const {
    isConnected,
    connectionState,
    subscribe,
    unsubscribe,
    requestInitialData,
    on,
  } = useWebSocket();
  const {
    servers,
    loading: serversLoading,
    error: serversError,
  } = useServerData();

  const server = useMemo(
    () => servers.find((s) => s.serverSlug === serverSlug),
    [servers, serverSlug],
  );

  const legacyServer = useMemo(() => {
    if (server || !serverSlug || !/^\d+$/.test(serverSlug)) return undefined;
    const legacyId = parseInt(serverSlug, 10);
    return servers.find((s) => s.serverId === legacyId);
  }, [server, servers, serverSlug]);

  const serverId = server?.serverId ?? null;
  const { getServerPlayers } = usePlayerData();
  const isMobile = useIsMobile();

  const onlineUsernames = useMemo(
    () =>
      new Set(
        serverId === null
          ? []
          : getServerPlayers(serverId).map((p) => p.username.toLowerCase()),
      ),
    [getServerPlayers, serverId],
  );

  const [messages, setMessages] = useState<CachedMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const [showScrollButton, setShowScrollButton] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [highlightedMessages, setHighlightedMessages] = useState<Set<string>>(
    new Set(),
  );

  /** Controls the player-list slide-over panel */
  const [playerListOpen, setPlayerListOpen] = useState(false);

  const isAtBottomRef = useRef(true);
  const lastMessageIdRef = useRef<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Single tick instance for the whole chat: re-renders timestamps every 60s
  // without each MessageRow running its own independent interval
  const tick = useRelativeTick();

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

  // Sort messages chronologically, then group
  const { groups: messageGroups, sorted } = useMemo(() => {
    const sorted = [...messages].sort((a, b) => {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
    return {
      groups: groupMessages(sorted),
      sorted,
    };
  }, [messages]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  const handleScrollToBottom = useCallback(() => {
    scrollToBottom();
    setUnreadCount(0);
  }, [scrollToBottom]);

  const handleImageLoad = useCallback(() => {
    if (isAtBottomRef.current) scrollToBottom();
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
        : [...prev, msg].slice(-MAX_MESSAGES);
    });
  }, []);

  const removeMessage = useCallback((messageId: string) => {
    setMessages((prev) => prev.filter((m) => m.messageId !== messageId));
  }, []);

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
    const previousId = lastMessageIdRef.current;
    const latestId = sorted[sorted.length - 1]?.messageId ?? null;
    lastMessageIdRef.current = latestId;

    if (!previousId || latestId === previousId) return;
    const previousIdx = sorted.findIndex((m) => m.messageId === previousId);
    if (previousIdx < 0) return;

    const newMessageCount = sorted.length - 1 - previousIdx;
    if (!isAtBottomRef.current) {
      setUnreadCount((prev) => prev + newMessageCount);
    } else {
      scrollToBottom();
    }
  }, [sorted, scrollToBottom]);

  if (legacyServer) {
    return <Navigate to={`/chat/${legacyServer.serverSlug}`} replace />;
  }

  if (!server) {
    if (serversError || connectionState === "error") {
      return <ChatFallback message="Chat is unavailable right now" />;
    }
    return <ChatFallback loading={serversLoading} message="Server not found" />;
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
            {server.serverName}
          </h1>
          <p className="text-sm text-muted-foreground">
            {server.online ? (
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
            <Button
              variant={playerListOpen ? "default" : "secondary"}
              size="icon"
              onClick={() => setPlayerListOpen((prev) => !prev)}
              title={playerListOpen ? "Close player list" : "Show player list"}
            >
              <Users className="size-5" />
            </Button>
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
                  const isOnline =
                    group.source === MessageSource.MINECRAFT && serverId
                      ? onlineUsernames.has(group.displayName.toLowerCase())
                      : undefined;

                  const isHighlighted = groupHighlights[idx];
                  const prevGroup =
                    idx > 0 ? messageGroups[idx - 1] : undefined;

                  return (
                    <MessageGroupComponent
                      key={`${group.key}-${group.messages[0]?.messageId}`}
                      group={group}
                      prevSource={prevGroup?.source}
                      tick={tick}
                      onImageLoad={handleImageLoad}
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

      <ChatComposer serverId={serverId} />
    </div>
  );
}
