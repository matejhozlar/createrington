import { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
  coerceAction,
  describeAction,
  PENDING_EMBED_KEY,
  INSERT_EMBED_EVENT,
  type AdminChatAction,
  type HighlightAction,
  type InsertEmbedAction,
} from "./actions";

const API_BASE = "/api/claude-chat";

interface RepoSuggestion {
  name: string;
  fullName: string;
  description: string;
  htmlUrl: string;
  private: boolean;
}

interface MentionState {
  /** Index of the `@` trigger in the input string. */
  start: number;
  /** Text typed after `@`, before the cursor. */
  query: string;
}

/**
 * Walk back from the cursor to find an active `@`-mention. Returns the
 * mention state or null. Triggers only when `@` sits at a word boundary
 * (start of input or after whitespace) and the query is plain
 * repo-name-ish text — a space or newline closes the menu.
 */
function detectMention(value: string, cursor: number): MentionState | null {
  if (cursor <= 0) return null;
  const before = value.slice(0, cursor);
  const at = before.lastIndexOf("@");
  if (at === -1) return null;
  const prev = at > 0 ? before[at - 1] : "";
  // Only trigger at word boundaries so email addresses / Discord handles
  // don't open the menu.
  if (prev && !/\s/.test(prev)) return null;
  const query = before.slice(at + 1);
  if (/[\s\n]/.test(query)) return null;
  // Allow a generous character set — repo names, partial org/repo, hyphens.
  if (!/^[A-Za-z0-9._/-]*$/.test(query)) return null;
  return { start: at, query };
}

interface StreamHandlers {
  onMessage: (m: ChatMessage) => void;
  onSessionEnded: () => void;
  onAction: (action: AdminChatAction) => void;
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
        } else if (event === "action") {
          // Envelope shape on the wire is { sessionId, action: {...} }.
          // Validate via the same forgiveness path the fence parser uses so
          // MCP-emitted actions get the same flat-field normalization.
          const envelope = (parsed as { action?: unknown }).action;
          const coerced = coerceAction(envelope);
          if (coerced) handlers.onAction(coerced);
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
  /**
   * Action envelopes delivered over SSE (MCP tool calls on the backend).
   * Separate from fence-parsed actions so both paths can coexist during the
   * MCP migration. Render order follows arrival time; the id stays stable so
   * ActionCard's sessionStorage persistence doesn't churn on rerenders.
   */
  const [streamActions, setStreamActions] = useState<
    Array<{ id: string; action: AdminChatAction }>
  >([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [starting, setStarting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // @-mention autocomplete for Createrington repos. Lazy-loaded on the
  // first `@` keystroke so opening the drawer doesn't fan out to Gitea if
  // the admin never uses the feature. Fetch runs once per session.
  const [repos, setRepos] = useState<RepoSuggestion[] | null>(null);
  const reposLoadingRef = useRef(false);
  const [mention, setMention] = useState<MentionState | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);

  const loadRepos = useCallback(async (): Promise<void> => {
    if (repos !== null || reposLoadingRef.current) return;
    reposLoadingRef.current = true;
    try {
      const res = await claudeFetch("/repos");
      if (!res.ok) {
        setRepos([]);
        return;
      }
      const data = (await res.json()) as { repos?: RepoSuggestion[] };
      setRepos(data.repos ?? []);
    } catch {
      setRepos([]);
    } finally {
      reposLoadingRef.current = false;
    }
  }, [repos]);

  const mentionMatches = useMemo<RepoSuggestion[]>(() => {
    if (!mention || !repos) return [];
    const q = mention.query.toLowerCase();
    return repos.filter((r) => r.name.toLowerCase().includes(q)).slice(0, 8);
  }, [mention, repos]);

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
      const value = e.target.value;
      setInput(value);
      const cursor = e.target.selectionStart ?? value.length;
      const next = detectMention(value, cursor);
      setMention(next);
      if (next) {
        void loadRepos();
        setMentionIndex(0);
      }
    },
    [loadRepos],
  );

  const acceptMention = useCallback(
    (repo: RepoSuggestion): void => {
      if (!mention) return;
      const before = input.slice(0, mention.start);
      const after = input.slice(mention.start + mention.query.length + 1);
      // Trailing space so the admin can keep typing without extra keystroke.
      const inserted = `${repo.fullName} `;
      const nextValue = before + inserted + after;
      const nextCursor = before.length + inserted.length;
      setInput(nextValue);
      setMention(null);
      // Restore focus + cursor after the controlled update flushes.
      requestAnimationFrame(() => {
        const ta = textareaRef.current;
        if (!ta) return;
        ta.focus();
        ta.setSelectionRange(nextCursor, nextCursor);
      });
    },
    [input, mention],
  );

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
            if (prev !== nextId) {
              setMessages([]);
              setStreamActions([]);
            }
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
      // Positive (server-assigned) ids come first, ascending. Optimistic
      // (negative) ids come after, with less-negative (created earlier)
      // before more-negative (created later) so a burst of sends stays
      // in send order instead of reversing.
      merged.sort((a, b) => {
        const aOpt = a.id < 0;
        const bOpt = b.id < 0;
        if (aOpt !== bOpt) return aOpt ? 1 : -1;
        if (aOpt) return b.id - a.id;
        return a.id - b.id;
      });
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
            onAction: (action) =>
              setStreamActions((prev) => [
                ...prev,
                {
                  id: `sse-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  action,
                },
              ]),
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
        setStreamActions([]);
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
    // Add the optimistic bubble BEFORE the POST. With SSE the real
    // message can arrive before the POST's await resolves; if we added
    // optimistic after, the SSE dedup pass has nothing to dedup against
    // and both end up in state. Negative id so it can't collide with a
    // DB sequence; mergeMessages swaps it out when the server copy
    // arrives with the same content.
    const optimisticId = -Date.now();
    setMessages((prev) => [
      ...prev,
      {
        id: optimisticId,
        role: "user" as const,
        content: trimmed,
        createdAt: new Date().toISOString(),
      },
    ]);
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
    } catch (err) {
      console.error("[admin-chat] Failed to send message:", err);
      setInput(trimmed);
      // POST failed — drop the optimistic so the admin doesn't see a
      // ghost message that never actually reached the backend.
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
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
    // When the mention menu is open, arrow keys + Enter/Tab drive it
    // instead of navigating the textarea / submitting the message.
    if (mention && mentionMatches.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((i) => (i + 1) % mentionMatches.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex(
          (i) => (i - 1 + mentionMatches.length) % mentionMatches.length,
        );
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        const chosen = mentionMatches[mentionIndex];
        if (chosen) acceptMention(chosen);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMention(null);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  const syncMentionFromCursor = useCallback(
    (ta: HTMLTextAreaElement): void => {
      // Arrow keys / clicks move the cursor without firing onChange, so
      // re-detect on keyup / click to keep the menu state in sync with
      // where the caret actually sits.
      const next = detectMention(
        ta.value,
        ta.selectionStart ?? ta.value.length,
      );
      setMention(next);
      if (next) void loadRepos();
    },
    [loadRepos],
  );

  // Bubble visibility — default hidden, toggled by Ctrl/Cmd+I. Clicking
  // the bubble (when shown) still opens/closes the drawer exactly as
  // before. Persisted in localStorage so an admin who enabled it doesn't
  // have to re-press on every page nav.
  const BUBBLE_KEY = "admin-chat:bubble-visible";
  const [bubbleVisible, setBubbleVisible] = useState<boolean>(() => {
    try {
      return localStorage.getItem(BUBBLE_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(BUBBLE_KEY, bubbleVisible ? "1" : "0");
    } catch {
      // Non-fatal — state still works within this tab.
    }
  }, [bubbleVisible]);

  // Global shortcut (Ctrl/Cmd+I) toggles the bubble's visibility.
  // Intentionally not documented in-app — if you found this comment
  // you're probably an admin who earned it. Only attaches when `enabled`
  // so non-admins and kill-switch-off sessions never even bind it.
  // Hiding the bubble also closes the drawer so there's no orphaned
  // panel floating without its toggle.
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
        if (e.key === "i" || e.key === "I") {
          e.preventDefault();
          setBubbleVisible((v) => {
            if (v) setOpen(false);
            return !v;
          });
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled]);

  if (!enabled) return null;
  if (!bubbleVisible) return null;

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
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          transition: transform 0.15s;
        }
        .ac-toggle:hover {
          transform: scale(1.08);
        }
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
        .ac-input-area {
          position: relative;
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
        .ac-mention-menu {
          position: absolute;
          bottom: calc(100% - 0.25rem);
          left: 0.75rem;
          right: 0.75rem;
          max-height: 14rem;
          overflow-y: auto;
          background: var(--popover, var(--card));
          border: 1px solid var(--border);
          border-radius: 0.5rem;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
          z-index: 10;
          padding: 0.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.125rem;
        }
        .ac-mention-item {
          text-align: left;
          border: none;
          background: transparent;
          color: var(--foreground);
          cursor: pointer;
          padding: 0.375rem 0.5rem;
          border-radius: 0.25rem;
          font-size: 0.8125rem;
          display: flex;
          flex-direction: column;
          gap: 0.125rem;
          font-family: inherit;
        }
        .ac-mention-item-active {
          background: var(--accent, var(--muted));
        }
        .ac-mention-name {
          font-weight: 500;
        }
        .ac-mention-desc {
          font-size: 0.6875rem;
          color: var(--muted-foreground);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
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
                <span className="ac-header-title">Createrington</span>
                <span
                  className="ac-header-breadcrumb"
                  title="Current page the assistant can see"
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
                  Createrington Assistant
                </p>
                <p style={{ fontSize: "0.75rem" }}>
                  Ask about players, database state, or report bugs.
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
                              msg.role === "assistant"
                                ? renderMarkdown(content)
                                : content.replace(/</g, "&lt;"),
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
                  {streamActions.map(({ id, action }) => (
                    <div key={id} className="ac-msg-row" data-role="assistant">
                      <ActionCard
                        action={action}
                        storageKey={id}
                        navigate={navigate}
                      />
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
                {sessionActive ? (
                  <div className="ac-input-area">
                    {mention && mentionMatches.length > 0 && (
                      <div className="ac-mention-menu" role="listbox">
                        {mentionMatches.map((repo, i) => (
                          <button
                            key={repo.fullName}
                            type="button"
                            className={`ac-mention-item${i === mentionIndex ? " ac-mention-item-active" : ""}`}
                            role="option"
                            aria-selected={i === mentionIndex}
                            // Prevent the textarea from losing focus before
                            // the click handler fires.
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => acceptMention(repo)}
                            onMouseEnter={() => setMentionIndex(i)}
                          >
                            <span className="ac-mention-name">{repo.name}</span>
                            {repo.description && (
                              <span className="ac-mention-desc">
                                {repo.description}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                    <textarea
                      ref={textareaRef}
                      className="ac-textarea"
                      value={input}
                      onChange={onInputChange}
                      onKeyDown={handleKeyDown}
                      onKeyUp={(e) => syncMentionFromCursor(e.currentTarget)}
                      onClick={(e) => syncMentionFromCursor(e.currentTarget)}
                      placeholder="Ask anything... (type @ for repo)"
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

        <button
          className="ac-toggle"
          onClick={() => setOpen((o) => !o)}
          title="Createrington Assistant (Ctrl+I to hide)"
        >
          {open ? <X size={20} /> : <MessageSquare size={20} />}
        </button>
      </div>
    </>
  );
}
