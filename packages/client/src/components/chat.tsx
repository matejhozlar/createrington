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
import { Send, Paperclip, X, Maximize2 } from "lucide-react";
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
  borderColor: string;
}

const SOURCE_CONFIG: Record<MessageSource, SourceConfig> = {
  [MessageSource.SYSTEM]: {
    label: "System",
    color: "text-muted-foreground",
    bgColor: "bg-muted/50",
    borderColor: "border-l-muted-foreground/50",
  },
  [MessageSource.DISCORD]: {
    label: "Discord",
    color: "text-sidebar-primary",
    bgColor: "bg-sidebar-primary/10",
    borderColor: "border-l-sidebar-primary",
  },
  [MessageSource.MINECRAFT]: {
    label: "Minecraft",
    color: "text-chart-2",
    bgColor: "bg-chart-2/10",
    borderColor: "border-l-chart-2",
  },
  [MessageSource.WEB]: {
    label: "Web",
    color: "text-chart-3",
    bgColor: "bg-chart-3/10",
    borderColor: "border-l-chart-3",
  },
};

function formatTime(raw: Date | string | undefined): string {
  if (!raw) return "";
  const d = raw instanceof Date ? raw : new Date(raw);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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
          className="size-8 rounded-full object-cover ring-1 ring-border"
          onError={() => setBroken(true)}
        />
      ) : (
        <div className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-sidebar-primary to-chart-4 text-xs font-semibold text-white ring-1 ring-border">
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
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        config.bgColor,
        config.color,
      )}
    >
      {config.label}
    </span>
  );
}

function MessageImage({
  url,
  alt,
  onFullscreen,
}: {
  url: string;
  alt: string;
  onFullscreen: () => void;
}) {
  return (
    <div className="group relative mt-2 inline-block max-w-xs overflow-hidden rounded-lg border border-border">
      <img
        src={url}
        alt={alt}
        className="max-h-48 w-full cursor-pointer object-cover transition-transform group-hover:scale-105"
        onClick={onFullscreen}
      />
      <button
        onClick={onFullscreen}
        className="absolute right-2 top-2 rounded-md bg-background/80 p-1.5 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100"
      >
        <Maximize2 className="size-4 text-foreground" />
      </button>
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

function MessageBubble({ message }: { message: CachedMessage }) {
  const [fullscreenImage, setFullscreenImage] = useState<{
    url: string;
    alt: string;
  } | null>(null);

  const source = (message.source as MessageSource) ?? MessageSource.DISCORD;
  const config = SOURCE_CONFIG[source];

  let displayName = message.authorDisplayname || message.authorUsername;
  let avatarUrl = message.authorAvatarUrl;

  if (source === MessageSource.MINECRAFT && message.minecraftData) {
    displayName = message.minecraftData.playerName;
  } else if (source === MessageSource.WEB && message.webData) {
    displayName = message.webData.originalAuthor.displayName;
    avatarUrl = message.webData.originalAuthor.avatarUrl;
  }

  const imageAttachments = message.attachments.filter((a) =>
    a.contentType?.startsWith("image/"),
  );

  return (
    <>
      <div
        className={cn(
          "group flex gap-3 border-l-2 px-4 py-3 transition-colors hover:bg-sidebar-accent/30",
          config.borderColor,
        )}
      >
        <Avatar url={avatarUrl} name={displayName} />

        <div className="min-w-0 flex-1">
          {/* Header */}
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">{displayName}</span>
            <SourceBadge source={source} />
            {message.isBot && source !== MessageSource.MINECRAFT && (
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 text-xs font-medium",
                  config.bgColor,
                  config.color,
                )}
              >
                BOT
              </span>
            )}
            <span className="ml-auto text-xs text-muted-foreground">
              {formatTime(message.createdAt)}
              {message.editedAt && (
                <span className="ml-1 opacity-70">(edited)</span>
              )}
            </span>
          </div>

          {/* Content with Markdown */}
          {message.content && (
            <div className="prose prose-sm dark:prose-invert mt-1 max-w-none break-words leading-relaxed">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  p: ({ children }) => (
                    <p className="my-1 text-sm text-foreground">{children}</p>
                  ),
                  a: ({ children, href }) => (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sidebar-primary hover:underline"
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
                      <code className="rounded bg-sidebar-accent px-1.5 py-0.5 text-sm font-mono text-foreground">
                        {children}
                      </code>
                    ) : (
                      <code className="block text-sm font-mono">
                        {children}
                      </code>
                    ),
                  pre: ({ children }) => (
                    <pre className="my-2 overflow-x-auto rounded-lg bg-sidebar-accent p-3 text-sm">
                      {children}
                    </pre>
                  ),
                  ul: ({ children }) => (
                    <ul className="my-1 list-disc pl-4 text-sm text-foreground">
                      {children}
                    </ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="my-1 list-decimal pl-4 text-sm text-foreground">
                      {children}
                    </ol>
                  ),
                  li: ({ children }) => (
                    <li className="text-foreground">{children}</li>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote className="my-2 border-l-2 border-sidebar-primary pl-3 italic text-muted-foreground">
                      {children}
                    </blockquote>
                  ),
                  h1: ({ children }) => (
                    <h1 className="my-2 text-lg font-bold text-foreground">
                      {children}
                    </h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="my-2 text-base font-bold text-foreground">
                      {children}
                    </h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="my-1 text-sm font-bold text-foreground">
                      {children}
                    </h3>
                  ),
                  strong: ({ children }) => (
                    <strong className="font-semibold text-foreground">
                      {children}
                    </strong>
                  ),
                  em: ({ children }) => (
                    <em className="italic text-foreground">{children}</em>
                  ),
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}

          {/* Images */}
          {imageAttachments.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {imageAttachments.map((img, i) => (
                <MessageImage
                  key={i}
                  url={img.url}
                  alt={img.filename}
                  onFullscreen={() =>
                    setFullscreenImage({ url: img.url, alt: img.filename })
                  }
                />
              ))}
            </div>
          )}

          {/* Embeds */}
          {message.embeds.map((embed, i) => (
            <div
              key={i}
              className="mt-2 rounded-lg border-l-4 bg-sidebar-accent/50 p-3"
              style={{
                borderLeftColor:
                  embed.color !== undefined
                    ? `#${embed.color.toString(16).padStart(6, "0")}`
                    : "hsl(var(--sidebar-primary))",
              }}
            >
              {embed.title && (
                <div className="prose prose-sm dark:prose-invert max-w-none break-words leading-tight">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({ children }) => (
                        <p className="my-0 text-sm font-semibold text-sidebar-primary">
                          {children}
                        </p>
                      ),
                      a: ({ children, href }) => (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sidebar-primary hover:underline font-semibold"
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
                          <code className="rounded bg-sidebar-accent px-1.5 py-0.5 text-xs font-mono text-sidebar-primary font-semibold">
                            {children}
                          </code>
                        ) : (
                          <code className="block text-xs font-mono">
                            {children}
                          </code>
                        ),
                      strong: ({ children }) => (
                        <strong className="font-bold text-sidebar-primary">
                          {children}
                        </strong>
                      ),
                      em: ({ children }) => (
                        <em className="italic text-sidebar-primary font-semibold">
                          {children}
                        </em>
                      ),
                    }}
                  >
                    {embed.title}
                  </ReactMarkdown>
                </div>
              )}
              {embed.description && (
                <div className="prose prose-sm dark:prose-invert mt-1 max-w-none break-words leading-relaxed">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({ children }) => (
                        <p className="my-0.5 text-sm text-muted-foreground">
                          {children}
                        </p>
                      ),
                      a: ({ children, href }) => (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sidebar-primary hover:underline"
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
                          <code className="rounded bg-sidebar-accent px-1.5 py-0.5 text-xs font-mono text-muted-foreground">
                            {children}
                          </code>
                        ) : (
                          <code className="block text-xs font-mono">
                            {children}
                          </code>
                        ),
                      pre: ({ children }) => (
                        <pre className="my-1 overflow-x-auto rounded-lg bg-sidebar p-2 text-xs">
                          {children}
                        </pre>
                      ),
                      ul: ({ children }) => (
                        <ul className="my-0.5 list-disc pl-4 text-xs text-muted-foreground">
                          {children}
                        </ul>
                      ),
                      ol: ({ children }) => (
                        <ol className="my-0.5 list-decimal pl-4 text-xs text-muted-foreground">
                          {children}
                        </ol>
                      ),
                      li: ({ children }) => (
                        <li className="text-muted-foreground">{children}</li>
                      ),
                      blockquote: ({ children }) => (
                        <blockquote className="my-1 border-l-2 border-sidebar-primary/50 pl-2 italic text-muted-foreground/80 text-xs">
                          {children}
                        </blockquote>
                      ),
                      h1: ({ children }) => (
                        <h1 className="my-1 text-sm font-bold text-muted-foreground">
                          {children}
                        </h1>
                      ),
                      h2: ({ children }) => (
                        <h2 className="my-1 text-sm font-bold text-muted-foreground">
                          {children}
                        </h2>
                      ),
                      h3: ({ children }) => (
                        <h3 className="my-0.5 text-xs font-bold text-muted-foreground">
                          {children}
                        </h3>
                      ),
                      strong: ({ children }) => (
                        <strong className="font-semibold text-muted-foreground">
                          {children}
                        </strong>
                      ),
                      em: ({ children }) => (
                        <em className="italic text-muted-foreground">
                          {children}
                        </em>
                      ),
                    }}
                  >
                    {embed.description}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          ))}
        </div>
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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const server = useMemo(
    () => servers.find((s) => s.serverId === serverId),
    [servers, serverId],
  );

  const canSend = !!user && serverId !== null && !sending;

  // Reverse messages for display (newest at bottom)
  const displayMessages = useMemo(() => {
    return [...messages].sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateA - dateB;
    });
  }, [messages]);

  // ============================================================================
  // Handlers
  // ============================================================================

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  const upsertMessage = useCallback((msg: CachedMessage) => {
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.messageId === msg.messageId);
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

      if (draft.trim()) {
        formData.append("content", draft.trim());
      }

      if (imageFile) {
        formData.append("image", imageFile);
      }

      const response = await fetch("/api/messages", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
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
        if (canSend && (draft.trim() || imageFile)) {
          sendMessage();
        }
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
        // Scroll to bottom immediately on load
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
          if (payload.message) {
            upsertMessage(payload.message);
          }
          break;
        case "delete":
          if (payload.messageId) {
            removeMessage(payload.messageId);
          }
          break;
      }
    });

    return unsub;
  }, [isConnected, serverId, on, upsertMessage, removeMessage]);

  // Auto-scroll when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [displayMessages.length, scrollToBottom]);

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
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-card/50 px-6 py-4 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-gradient-to-br from-sidebar-primary to-chart-4">
            <span className="text-lg font-bold text-white">
              {server?.serverName.charAt(0) ?? "S"}
            </span>
          </div>
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
        </div>

        <div className="flex items-center gap-2">
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
      </div>

      {/* Messages with custom scrollbar */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/50"
      >
        {displayMessages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-sidebar-accent">
                <span className="text-2xl">💬</span>
              </div>
              <p className="text-muted-foreground">No messages yet</p>
              <p className="mt-1 text-sm text-muted-foreground/70">
                Be the first to send a message!
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {displayMessages.map((msg) => (
              <MessageBubble key={msg.messageId} message={msg} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-border bg-card/50 p-4 backdrop-blur-sm">
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
            className="flex-1 resize-none rounded-lg border border-border bg-sidebar-accent px-4 text-sm text-foreground placeholder-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-40 h-10 leading-10 overflow-hidden"
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
