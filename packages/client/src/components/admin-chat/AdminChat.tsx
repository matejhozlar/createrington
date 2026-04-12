import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/auth";
import { getAccessToken } from "@/services/auth/token-manager";
import {
  MessageSquare,
  X,
  Send,
  Loader2,
  Square,
  Sparkles,
  Check,
} from "lucide-react";
import {
  parseActionsFromMessage,
  describeAction,
  PENDING_EMBED_KEY,
  INSERT_EMBED_EVENT,
  type AdminChatAction,
  type HighlightAction,
  type InsertEmbedAction,
} from "./actions";

const API_BASE = "/api/claude-chat";

interface StreamHandlers {
  onMessage: (m: ChatMessage) => void;
  onSessionEnded: () => void;
  onOpen?: () => void;
  onError?: () => void;
}

/**
 * Open an SSE stream through the proxy. EventSource can't attach the
 * Bearer token, so we use fetch + ReadableStream and parse SSE frames
 * manually. Each frame is separated by a blank line; event-type defaults
 * to "message" when omitted.
 */
async function runStream(
  sessionId: number,
  handlers: StreamHandlers,
  abort: AbortSignal,
): Promise<void> {
  const token = getAccessToken();
  const response = await fetch(`${API_BASE}/stream?sessionId=${sessionId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal: abort,
  });
  if (!response.ok || !response.body) {
    handlers.onError?.();
    return;
  }
  handlers.onOpen?.();
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    // Frame boundary is a blank line (CRLF or LF).
    let idx: number;
    while ((idx = buffer.search(/\r?\n\r?\n/)) !== -1) {
      const frame = buffer.slice(0, idx);
      buffer = buffer.slice(idx).replace(/^\r?\n\r?\n/, "");
      let event = "message";
      const dataLines: string[] = [];
      for (const line of frame.split(/\r?\n/)) {
        if (line.startsWith(":")) continue; // comment / keepalive
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
      }
      if (dataLines.length === 0) continue;
      try {
        const parsed = JSON.parse(dataLines.join("\n")) as unknown;
        if (event === "message") {
          handlers.onMessage(parsed as ChatMessage);
        } else if (event === "session_ended") {
          handlers.onSessionEnded();
        }
      } catch {
        // Ignore malformed frame — next one will probably be fine.
      }
    }
  }
}

/**
 * pageContext passed to the proxy on every start/send. Gives Claude enough
 * to say "you're already on /admin/players — click the Ban button on the
 * row" instead of guessing where features live.
 */
interface PageContext {
  type: "admin-chat" | "admin" | "page";
  owner: "Createrington";
  repo: "app";
  pathname: string;
  search?: string;
  title?: string;
}

interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  metadata?: {
    isAck?: boolean;
    isProgress?: boolean;
    isIdleWarning?: boolean;
    isIdleTimeout?: boolean;
    streaming?: boolean;
  } | null;
  createdAt: string;
}

/**
 * Fetch through the app backend proxy, which injects the admin-chat shared
 * secret and forwards to claude-automation. The JWT auth header is required
 * so the proxy can gate on isAdmin and derive the username.
 */
async function claudeFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const token = getAccessToken();
  const headers = new Headers(init?.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(`${API_BASE}${path}`, { ...init, headers });
}

function renderMarkdown(text: string): string {
  // Escape HTML first so raw tags in the upstream payload can't execute —
  // the markdown regexes below re-introduce only the specific tags we allow.
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Code blocks
  html = html.replace(
    /```(\w*)\n([\s\S]*?)```/g,
    '<pre class="ac-code-block"><code>$2</code></pre>',
  );

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="ac-inline-code">$1</code>');

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  // Italic
  html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<em>$1</em>");

  // Links — allow http(s) URLs (open in new tab) and same-origin relative
  // paths (handled as in-app React Router navigation via delegated click
  // handler below, marked with data-nav). Anything else (including
  // "javascript:" and protocol-relative "//evil.com") is rendered as plain
  // text so it can't land in an href.
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_match, label: string, url: string) => {
      if (/^https?:\/\//i.test(url)) {
        return `<a href="${url}" target="_blank" rel="noopener" class="ac-link">${label}</a>`;
      }
      if (/^\/[^/]/.test(url) || url === "/") {
        return `<a href="${url}" data-nav="1" class="ac-link">${label}</a>`;
      }
      return label;
    },
  );

  // Line breaks (skip inside <pre>)
  html = html.replace(/\n/g, "<br>");
  html = html.replace(
    /<pre class="ac-code-block"><code>([\s\S]*?)<\/code><\/pre>/g,
    (_m, code: string) => {
      return `<pre class="ac-code-block"><code>${(code as string).replace(/<br>/g, "\n")}</code></pre>`;
    },
  );

  return html;
}

/**
 * Apply a highlight action to the current document. Scrolls the element
 * into view and flashes an outline via .ac-highlighted for ttlMs (default
 * 3s). Returns true if the selector matched an element.
 */
function applyHighlight(action: HighlightAction): boolean {
  try {
    const el = document.querySelector(action.selector);
    if (!(el instanceof HTMLElement)) return false;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ac-highlighted");
    const ttl = action.ttlMs ?? 3000;
    window.setTimeout(() => el.classList.remove("ac-highlighted"), ttl);
    return true;
  } catch {
    return false;
  }
}

/**
 * Apply an insert_embed action. If the user is already on the embed
 * builder, dispatches INSERT_EMBED_EVENT so it can apply immediately.
 * Otherwise stashes the embed in sessionStorage under PENDING_EMBED_KEY
 * and navigates there — the builder picks it up on mount.
 */
function applyInsertEmbed(
  action: InsertEmbedAction,
  navigate: (to: string) => void,
): void {
  const serialized = JSON.stringify(action.embed);
  const onBuilderPage = window.location.pathname.startsWith(
    "/admin/tools/embed-builder",
  );
  if (onBuilderPage) {
    window.dispatchEvent(
      new CustomEvent(INSERT_EMBED_EVENT, { detail: action.embed }),
    );
    return;
  }
  try {
    sessionStorage.setItem(PENDING_EMBED_KEY, serialized);
  } catch {
    // Best-effort — if storage is unavailable, navigation alone still lets
    // the admin reapply from chat history.
  }
  navigate("/admin/tools/embed-builder");
}

interface ActionCardProps {
  action: AdminChatAction;
  /** Unique-per-session key for persisting applied state across polls. */
  storageKey: string;
  navigate: (to: string) => void;
}

function ActionCard({
  action,
  storageKey,
  navigate,
}: ActionCardProps): React.JSX.Element {
  const persistKey = `admin-chat-action:${storageKey}`;
  const [state, setState] = useState<"pending" | "applied" | "dismissed">(
    () => {
      try {
        const v = sessionStorage.getItem(persistKey);
        if (v === "applied" || v === "dismissed") return v;
      } catch {
        // ignore
      }
      return "pending";
    },
  );

  const setPersistent = useCallback(
    (next: "applied" | "dismissed") => {
      setState(next);
      try {
        sessionStorage.setItem(persistKey, next);
      } catch {
        // ignore
      }
    },
    [persistKey],
  );

  const onApply = (): void => {
    if (action.type === "highlight") {
      const ok = applyHighlight(action);
      setPersistent(ok ? "applied" : "dismissed");
    } else {
      applyInsertEmbed(action, navigate);
      setPersistent("applied");
    }
  };

  return (
    <div className={`ac-action-card ac-action-${state}`}>
      <div className="ac-action-head">
        <Sparkles size={12} />
        <span className="ac-action-type">
          {action.type === "highlight" ? "Highlight" : "Insert embed"}
        </span>
        <span className="ac-action-desc">{describeAction(action)}</span>
      </div>
      {action.type === "insert_embed" && (
        <div className="ac-action-embed-preview">
          {action.embed.title && (
            <div className="ac-action-embed-title">
              {String(action.embed.title)}
            </div>
          )}
          {action.embed.description && (
            <div className="ac-action-embed-desc">
              {String(action.embed.description)}
            </div>
          )}
        </div>
      )}
      <div className="ac-action-buttons">
        {state === "pending" ? (
          <>
            <button className="ac-action-apply" onClick={onApply} type="button">
              <Check size={12} />
              Apply
            </button>
            <button
              className="ac-action-dismiss"
              onClick={() => setPersistent("dismissed")}
              type="button"
            >
              Dismiss
            </button>
          </>
        ) : (
          <span className="ac-action-status">
            {state === "applied" ? "Applied" : "Dismissed"}
          </span>
        )}
      </div>
    </div>
  );
}

export function AdminChat(): React.JSX.Element | null {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [sessionActive, setSessionActive] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [starting, setStarting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  /** Snapshot of the admin's current page — sent with every start/send. */
  const pageContext = useCallback(
    (type: PageContext["type"]): PageContext => ({
      type,
      owner: "Createrington",
      repo: "app",
      pathname: location.pathname,
      ...(location.search && { search: location.search }),
      ...(typeof document !== "undefined" && document.title
        ? { title: document.title }
        : {}),
    }),
    [location.pathname, location.search],
  );

  // Check if admin chat is enabled
  useEffect(() => {
    if (!user?.isAdmin) {
      setEnabled(false);
      return;
    }

    claudeFetch("/enabled")
      .then((r) => (r.ok ? r.json() : { enabled: false }))
      .then((data: { enabled?: boolean }) => setEnabled(data.enabled === true))
      .catch(() => setEnabled(false));
  }, [user]);

  // Check for existing session on open
  useEffect(() => {
    if (!open || !user?.isAdmin) return;

    claudeFetch("/session")
      .then((r) => r.json())
      .then(
        (data: {
          active?: boolean;
          sessionId?: number | null;
          lastSessionId?: number | null;
        }) => {
          const nextId = data.active ? data.sessionId : data.lastSessionId;
          if (!nextId) return;
          // Only tear down message state when the session ID is actually
          // changing — reopening the drawer on the same session would
          // otherwise flicker between empty → messages as the stream
          // refills.
          setSessionId((prev) => {
            if (prev !== nextId) setMessages([]);
            return nextId;
          });
          setSessionActive(Boolean(data.active));
        },
      )
      .catch(console.error);
  }, [open, user]);

  /**
   * Merge one or a batch of incoming messages into state by id. Streaming
   * rows update in place (same id, growing content); new rows append.
   * Also swaps out optimistic user messages (id < 0) once the server's
   * copy of the same content arrives.
   */
  const mergeMessages = useCallback((incoming: ChatMessage[]): void => {
    if (incoming.length === 0) return;
    setMessages((prev) => {
      const byId = new Map<number, ChatMessage>(
        prev.map((m) => [m.id, m] as const),
      );
      for (const m of incoming) byId.set(m.id, m);
      const incomingUserContent = new Set(
        incoming.filter((m) => m.role === "user").map((m) => m.content),
      );
      const merged = Array.from(byId.values()).filter(
        (m) =>
          !(
            m.id < 0 &&
            m.role === "user" &&
            incomingUserContent.has(m.content)
          ),
      );
      merged.sort((a, b) => a.id - b.id);
      return merged;
    });
  }, []);

  // Load history once + open the SSE stream. History comes from the
  // existing /messages?afterId=0 endpoint so the transcript renders
  // immediately on drawer open; live events take over from there.
  useEffect(() => {
    if (!sessionId || !open) return;

    const abort = new AbortController();
    let cancelled = false;

    (async (): Promise<void> => {
      try {
        const res = await claudeFetch(`/messages?sessionId=${sessionId}`);
        if (cancelled) return;
        const data = (await res.json()) as {
          messages?: ChatMessage[];
          sessionActive?: boolean;
        };
        if (data.messages) mergeMessages(data.messages);
        if (data.sessionActive !== undefined) {
          setSessionActive(data.sessionActive);
        }
      } catch {
        // Non-fatal — live stream will still surface new messages.
      }

      if (cancelled) return;
      try {
        await runStream(
          sessionId,
          {
            onMessage: (m) => mergeMessages([m]),
            onSessionEnded: () => setSessionActive(false),
          },
          abort.signal,
        );
      } catch (err) {
        if ((err as { name?: string }).name !== "AbortError") {
          console.error("[admin-chat] stream error:", err);
        }
      }
    })();

    return () => {
      cancelled = true;
      abort.abort();
    };
  }, [sessionId, open, mergeMessages]);

  // Auto-scroll on new messages — smooth so the eye can follow.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Snap to bottom on drawer reopen so the latest message is visible
  // without a scroll-up animation. Runs in rAF so the messages container
  // has a chance to lay out after `open` flips to true.
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
    });
    return () => cancelAnimationFrame(id);
  }, [open]);

  const startSession = async (): Promise<void> => {
    if (!user?.isAdmin) return;
    setStarting(true);
    try {
      const res = await claudeFetch("/start", {
        method: "POST",
        body: JSON.stringify({
          pageContext: pageContext("admin-chat"),
        }),
      });
      const data = (await res.json()) as {
        sessionId?: number;
        error?: string;
      };
      if (data.sessionId) {
        setSessionId(data.sessionId);
        setSessionActive(true);
        setMessages([]);
      }
    } catch (err) {
      console.error("[admin-chat] Failed to start session:", err);
    } finally {
      setStarting(false);
    }
  };

  const sendMessage = async (): Promise<void> => {
    const trimmed = input.trim();
    if (!trimmed || !sessionId) return;
    setSending(true);
    setInput("");
    try {
      await claudeFetch("/send", {
        method: "POST",
        body: JSON.stringify({
          sessionId,
          message: trimmed,
          pageContext: pageContext(
            location.pathname.startsWith("/admin") ? "admin" : "page",
          ),
        }),
      });
      // Optimistic add — negative id so it never collides with a server
      // sequence id; the poll dedup below swaps this out when the persisted
      // copy arrives.
      setMessages((prev) => [
        ...prev,
        {
          id: -Date.now(),
          role: "user" as const,
          content: trimmed,
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      console.error("[admin-chat] Failed to send message:", err);
      setInput(trimmed);
    } finally {
      setSending(false);
    }
  };

  const endSession = async (): Promise<void> => {
    if (!sessionId) return;
    try {
      await claudeFetch("/end", {
        method: "POST",
        body: JSON.stringify({ sessionId }),
      });
      setSessionActive(false);
    } catch (err) {
      console.error("[admin-chat] Failed to end session:", err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  if (!enabled) return null;

  return (
    <>
      <style>{`
        .ac-widget {
          position: fixed;
          bottom: 1.25rem;
          right: 1.25rem;
          z-index: 9999;
          font-family: inherit;
        }
        .ac-toggle {
          width: 3rem;
          height: 3rem;
          border-radius: 50%;
          background: var(--primary);
          color: var(--primary-foreground);
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          transition: transform 0.15s;
        }
        .ac-toggle:hover { transform: scale(1.08); }
        .ac-panel {
          position: fixed;
          bottom: 5rem;
          right: 1.25rem;
          width: 24rem;
          max-width: calc(100vw - 2.5rem);
          height: 32rem;
          max-height: calc(100vh - 7rem);
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 0.75rem;
          display: flex;
          flex-direction: column;
          box-shadow: 0 8px 32px rgba(0,0,0,0.4);
          overflow: hidden;
        }
        .ac-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem 1rem;
          border-bottom: 1px solid var(--border);
          flex-shrink: 0;
        }
        .ac-header-meta {
          display: flex;
          flex-direction: column;
          gap: 0.125rem;
          min-width: 0;
        }
        .ac-header-title {
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--foreground);
        }
        .ac-header-breadcrumb {
          font-size: 0.625rem;
          color: var(--muted-foreground);
          font-family: ui-monospace, monospace;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 14rem;
        }
        .ac-header-status {
          font-size: 0.625rem;
          padding: 0.125rem 0.5rem;
          border-radius: 9999px;
          font-weight: 500;
        }
        .ac-status-active {
          background: hsl(142 76% 36% / 0.15);
          color: hsl(142 76% 56%);
        }
        .ac-status-inactive {
          background: var(--muted);
          color: var(--muted-foreground);
        }
        .ac-messages {
          flex: 1;
          overflow-y: auto;
          padding: 0.75rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .ac-msg {
          max-width: 85%;
          padding: 0.5rem 0.75rem;
          border-radius: 0.5rem;
          font-size: 0.8125rem;
          line-height: 1.5;
          word-break: break-word;
        }
        .ac-msg-user {
          align-self: flex-end;
          background: var(--primary);
          color: var(--primary-foreground);
        }
        .ac-msg-assistant {
          align-self: flex-start;
          background: var(--muted);
          color: var(--foreground);
        }
        .ac-msg-ack {
          opacity: 0.6;
          font-style: italic;
          font-size: 0.75rem;
        }
        .ac-msg-progress {
          opacity: 0.5;
          font-size: 0.75rem;
        }
        .ac-code-block {
          background: var(--background);
          border-radius: 0.375rem;
          padding: 0.5rem;
          margin: 0.25rem 0;
          overflow-x: auto;
          font-size: 0.75rem;
          font-family: ui-monospace, monospace;
          white-space: pre;
        }
        .ac-inline-code {
          background: var(--background);
          padding: 0.1rem 0.3rem;
          border-radius: 0.25rem;
          font-size: 0.75rem;
          font-family: ui-monospace, monospace;
        }
        .ac-link {
          color: var(--primary);
          text-decoration: underline;
        }
        .ac-msg-row {
          display: flex;
          flex-direction: column;
          gap: 0.375rem;
        }
        .ac-msg-row[data-role="user"] {
          align-items: flex-end;
        }
        .ac-action-card {
          align-self: stretch;
          max-width: 90%;
          background: var(--muted);
          border: 1px solid var(--border);
          border-radius: 0.5rem;
          padding: 0.5rem 0.625rem;
          display: flex;
          flex-direction: column;
          gap: 0.375rem;
          font-size: 0.75rem;
        }
        .ac-action-applied { opacity: 0.7; }
        .ac-action-dismissed { opacity: 0.5; }
        .ac-action-head {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          color: var(--muted-foreground);
        }
        .ac-action-type {
          font-weight: 600;
          color: var(--foreground);
          font-size: 0.625rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .ac-action-desc {
          flex: 1;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .ac-action-embed-preview {
          border-left: 3px solid var(--primary);
          padding: 0.25rem 0.5rem;
          background: var(--background);
          border-radius: 0.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.125rem;
        }
        .ac-action-embed-title {
          font-weight: 600;
          color: var(--foreground);
        }
        .ac-action-embed-desc {
          color: var(--muted-foreground);
          font-size: 0.6875rem;
          line-height: 1.4;
          max-height: 3em;
          overflow: hidden;
        }
        .ac-action-buttons {
          display: flex;
          gap: 0.375rem;
          align-items: center;
        }
        .ac-action-apply,
        .ac-action-dismiss {
          padding: 0.25rem 0.625rem;
          border-radius: 0.25rem;
          border: none;
          cursor: pointer;
          font-size: 0.6875rem;
          font-weight: 500;
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
        }
        .ac-action-apply {
          background: var(--primary);
          color: var(--primary-foreground);
        }
        .ac-action-dismiss {
          background: transparent;
          color: var(--muted-foreground);
        }
        .ac-action-status {
          font-size: 0.6875rem;
          color: var(--muted-foreground);
          font-style: italic;
        }
        @keyframes ac-highlight-pulse {
          0%, 100% { box-shadow: 0 0 0 3px var(--primary); }
          50% { box-shadow: 0 0 0 6px var(--primary); }
        }
        .ac-highlighted {
          outline: 2px solid var(--primary) !important;
          outline-offset: 4px !important;
          border-radius: 4px;
          animation: ac-highlight-pulse 1s ease-in-out infinite;
          scroll-margin: 4rem;
        }
        .ac-caret {
          display: inline-block;
          width: 0.5em;
          height: 1em;
          margin-left: 0.125em;
          vertical-align: text-bottom;
          background: currentColor;
          opacity: 0.7;
          animation: ac-caret-blink 1s steps(2) infinite;
        }
        @keyframes ac-caret-blink {
          50% { opacity: 0; }
        }
        .ac-input-area {
          padding: 0.75rem;
          border-top: 1px solid var(--border);
          display: flex;
          gap: 0.5rem;
          align-items: flex-end;
          flex-shrink: 0;
        }
        .ac-ended-bar {
          padding: 0.75rem;
          border-top: 1px solid var(--border);
          display: flex;
          gap: 0.75rem;
          align-items: center;
          justify-content: space-between;
          flex-shrink: 0;
        }
        .ac-ended-note {
          font-size: 0.75rem;
          color: var(--muted-foreground);
        }
        .ac-textarea {
          flex: 1;
          resize: none;
          border: 1px solid var(--border);
          border-radius: 0.5rem;
          padding: 0.5rem 0.75rem;
          font-size: 0.8125rem;
          background: var(--background);
          color: var(--foreground);
          outline: none;
          max-height: 6rem;
          font-family: inherit;
          line-height: 1.5;
        }
        .ac-textarea:focus { border-color: var(--ring); }
        .ac-send-btn {
          width: 2rem;
          height: 2rem;
          border-radius: 0.375rem;
          background: var(--primary);
          color: var(--primary-foreground);
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .ac-send-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .ac-empty {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          padding: 2rem;
          text-align: center;
          color: var(--muted-foreground);
        }
        .ac-start-btn {
          padding: 0.5rem 1.25rem;
          border-radius: 0.5rem;
          background: var(--primary);
          color: var(--primary-foreground);
          border: none;
          cursor: pointer;
          font-size: 0.8125rem;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 0.375rem;
        }
        .ac-start-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .ac-icon-btn {
          background: none;
          border: none;
          cursor: pointer;
          color: var(--muted-foreground);
          padding: 0.25rem;
          display: flex;
          align-items: center;
        }
        .ac-icon-btn:hover { color: var(--foreground); }
        .ac-header-actions {
          display: flex;
          align-items: center;
          gap: 0.25rem;
        }
      `}</style>

      <div className="ac-widget">
        {open && (
          <div className="ac-panel">
            <div className="ac-header">
              <div className="ac-header-meta">
                <span className="ac-header-title">Claude</span>
                <span
                  className="ac-header-breadcrumb"
                  title="What Claude sees as your current page"
                >
                  {location.pathname}
                </span>
              </div>
              <div className="ac-header-actions">
                {sessionActive && (
                  <span className="ac-header-status ac-status-active">
                    Active
                  </span>
                )}
                {sessionActive && (
                  <button
                    className="ac-icon-btn"
                    onClick={() => void endSession()}
                    title="End session"
                  >
                    <Square size={14} />
                  </button>
                )}
                <button
                  className="ac-icon-btn"
                  onClick={() => setOpen(false)}
                  title="Close"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {!sessionId || (!sessionActive && messages.length === 0) ? (
              <div className="ac-empty">
                <MessageSquare size={32} strokeWidth={1.5} />
                <p style={{ fontSize: "0.875rem", fontWeight: 500 }}>
                  Admin Assistant
                </p>
                <p style={{ fontSize: "0.75rem" }}>
                  Ask about players, database state, or report bugs to create
                  issues.
                </p>
                <button
                  className="ac-start-btn"
                  onClick={() => void startSession()}
                  disabled={starting}
                >
                  {starting && <Loader2 size={14} className="animate-spin" />}
                  Start chat
                </button>
              </div>
            ) : (
              <>
                <div
                  className="ac-messages"
                  onClick={(e) => {
                    // Delegated handler for in-app nav links that Claude
                    // embeds in replies (markdown link → href="/admin/...").
                    // Real anchors still get ctrl/middle-click behavior.
                    const target = (e.target as HTMLElement).closest(
                      "a[data-nav='1']",
                    );
                    if (!target) return;
                    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
                    const href = target.getAttribute("href");
                    if (!href || !href.startsWith("/")) return;
                    e.preventDefault();
                    navigate(href);
                  }}
                >
                  {messages.map((msg) => {
                    const isAck = !!(msg.metadata as { isAck?: boolean })
                      ?.isAck;
                    const isProgress = !!(
                      msg.metadata as { isProgress?: boolean }
                    )?.isProgress;
                    const isStreaming = !!(
                      msg.metadata as { streaming?: boolean }
                    )?.streaming;
                    // Don't parse action envelopes out of a half-written
                    // message — the envelope might not be complete yet.
                    // Wait until the stream settles.
                    const { content, actions } =
                      msg.role === "assistant" && !isStreaming
                        ? parseActionsFromMessage(msg.content)
                        : { content: msg.content, actions: [] };
                    return (
                      <div
                        key={msg.id}
                        className="ac-msg-row"
                        data-role={msg.role}
                      >
                        <div
                          className={`ac-msg ac-msg-${msg.role}${isAck ? " ac-msg-ack" : ""}${isProgress ? " ac-msg-progress" : ""}${isStreaming ? " ac-msg-streaming" : ""}`}
                          dangerouslySetInnerHTML={{
                            __html:
                              (msg.role === "assistant"
                                ? renderMarkdown(content)
                                : content.replace(/</g, "&lt;")) +
                              (isStreaming
                                ? '<span class="ac-caret" aria-hidden="true"></span>'
                                : ""),
                          }}
                        />
                        {actions.map((action, i) => (
                          <ActionCard
                            key={`${msg.id}:${i}`}
                            action={action}
                            storageKey={`${msg.id}:${i}`}
                            navigate={navigate}
                          />
                        ))}
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
                {sessionActive ? (
                  <div className="ac-input-area">
                    <textarea
                      className="ac-textarea"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Ask anything..."
                      disabled={sending}
                      rows={1}
                    />
                    <button
                      className="ac-send-btn"
                      onClick={() => void sendMessage()}
                      disabled={sending || input.trim().length === 0}
                    >
                      {sending ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Send size={14} />
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="ac-ended-bar">
                    <span className="ac-ended-note">Session ended</span>
                    <button
                      className="ac-start-btn"
                      onClick={() => void startSession()}
                      disabled={starting}
                    >
                      {starting && (
                        <Loader2 size={14} className="animate-spin" />
                      )}
                      Start new chat
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <button className="ac-toggle" onClick={() => setOpen((o) => !o)}>
          {open ? <X size={20} /> : <MessageSquare size={20} />}
        </button>
      </div>
    </>
  );
}
