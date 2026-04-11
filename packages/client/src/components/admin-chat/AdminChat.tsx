import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/auth";
import { MessageSquare, X, Send, Loader2, Square } from "lucide-react";

const CLAUDE_API_URL = import.meta.env.VITE_CLAUDE_API_URL as
  | string
  | undefined;
const ENVIRONMENT = import.meta.env.PROD ? "prod" : "dev";
const REPO = "Createrington/app";
const POLL_INTERVAL = 800;

interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  metadata?: { isAck?: boolean; isProgress?: boolean } | null;
  createdAt: string;
}

function renderMarkdown(text: string): string {
  let html = text;

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

  // Links
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener" class="ac-link">$1</a>',
  );

  // Line breaks (skip inside <pre>)
  html = html.replace(/\n/g, "<br>");
  html = html.replace(/<pre class="ac-code-block"><code>([\s\S]*?)<\/code><\/pre>/g, (_m, code: string) => {
    return `<pre class="ac-code-block"><code>${(code as string).replace(/<br>/g, "\n")}</code></pre>`;
  });

  return html;
}

export function AdminChat(): React.JSX.Element | null {
  const { user } = useAuth();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [sessionActive, setSessionActive] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [starting, setStarting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastIdRef = useRef(0);

  const username = user?.username ?? user?.discordId ?? "";

  // Check if admin chat is enabled
  useEffect(() => {
    if (!user?.isAdmin || !CLAUDE_API_URL) {
      setEnabled(false);
      return;
    }

    fetch(
      `${CLAUDE_API_URL}/api/chat/enabled?repo=${encodeURIComponent(REPO)}&environment=${ENVIRONMENT}`,
    )
      .then((r) => r.json())
      .then((data: { enabled?: boolean }) => setEnabled(data.enabled === true))
      .catch(() => setEnabled(false));
  }, [user]);

  // Check for existing session on open
  useEffect(() => {
    if (!open || !username || !CLAUDE_API_URL) return;

    fetch(
      `${CLAUDE_API_URL}/api/chat/session?username=${encodeURIComponent(username)}`,
    )
      .then((r) => r.json())
      .then(
        (data: {
          active?: boolean;
          sessionId?: number | null;
          lastSessionId?: number | null;
        }) => {
          if (data.active && data.sessionId) {
            setSessionId(data.sessionId);
            setSessionActive(true);
          } else if (data.lastSessionId) {
            setSessionId(data.lastSessionId);
            setSessionActive(false);
          }
        },
      )
      .catch(console.error);
  }, [open, username]);

  // Poll for messages
  const pollMessages = useCallback((): void => {
    if (!sessionId || !username || !CLAUDE_API_URL) return;

    fetch(
      `${CLAUDE_API_URL}/api/chat/messages?username=${encodeURIComponent(username)}&sessionId=${sessionId}&afterId=${lastIdRef.current}`,
    )
      .then((r) => r.json())
      .then(
        (data: {
          messages?: ChatMessage[];
          sessionActive?: boolean;
        }) => {
          if (data.messages && data.messages.length > 0) {
            setMessages((prev) => {
              const existingIds = new Set(prev.map((m) => m.id));
              const newMsgs = data.messages!.filter(
                (m) => !existingIds.has(m.id),
              );
              return newMsgs.length > 0 ? [...prev, ...newMsgs] : prev;
            });
            lastIdRef.current = data.messages[data.messages.length - 1].id;
          }
          if (data.sessionActive !== undefined) {
            setSessionActive(data.sessionActive);
          }
        },
      )
      .catch(console.error);
  }, [sessionId, username]);

  useEffect(() => {
    if (!sessionId || !open) return;
    // Initial fetch
    pollMessages();
    // Start polling
    pollRef.current = setInterval(pollMessages, POLL_INTERVAL);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [sessionId, open, pollMessages]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const startSession = async (): Promise<void> => {
    if (!username || !CLAUDE_API_URL) return;
    setStarting(true);
    try {
      const res = await fetch(`${CLAUDE_API_URL}/api/chat/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          repo: REPO,
          environment: ENVIRONMENT,
          pageContext: {
            type: "admin-chat",
            owner: "Createrington",
            repo: "app",
          },
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
        lastIdRef.current = 0;
      }
    } catch (err) {
      console.error("[admin-chat] Failed to start session:", err);
    } finally {
      setStarting(false);
    }
  };

  const sendMessage = async (): Promise<void> => {
    const trimmed = input.trim();
    if (!trimmed || !sessionId || !username || !CLAUDE_API_URL) return;
    setSending(true);
    setInput("");
    try {
      await fetch(`${CLAUDE_API_URL}/api/chat/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          sessionId,
          message: trimmed,
          pageContext: {
            type: window.location.pathname.startsWith("/admin")
              ? "admin"
              : "page",
            owner: "Createrington",
            repo: "app",
          },
        }),
      });
      // Optimistic add
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
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
    if (!sessionId || !username || !CLAUDE_API_URL) return;
    try {
      await fetch(`${CLAUDE_API_URL}/api/chat/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, sessionId }),
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
          background: hsl(var(--primary));
          color: hsl(var(--primary-foreground));
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
          background: hsl(var(--card));
          border: 1px solid hsl(var(--border));
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
          border-bottom: 1px solid hsl(var(--border));
          flex-shrink: 0;
        }
        .ac-header-title {
          font-size: 0.875rem;
          font-weight: 600;
          color: hsl(var(--foreground));
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
          background: hsl(var(--muted));
          color: hsl(var(--muted-foreground));
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
          background: hsl(var(--primary));
          color: hsl(var(--primary-foreground));
        }
        .ac-msg-assistant {
          align-self: flex-start;
          background: hsl(var(--muted));
          color: hsl(var(--foreground));
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
          background: hsl(var(--background));
          border-radius: 0.375rem;
          padding: 0.5rem;
          margin: 0.25rem 0;
          overflow-x: auto;
          font-size: 0.75rem;
          font-family: ui-monospace, monospace;
          white-space: pre;
        }
        .ac-inline-code {
          background: hsl(var(--background));
          padding: 0.1rem 0.3rem;
          border-radius: 0.25rem;
          font-size: 0.75rem;
          font-family: ui-monospace, monospace;
        }
        .ac-link {
          color: hsl(var(--primary));
          text-decoration: underline;
        }
        .ac-input-area {
          padding: 0.75rem;
          border-top: 1px solid hsl(var(--border));
          display: flex;
          gap: 0.5rem;
          align-items: flex-end;
          flex-shrink: 0;
        }
        .ac-textarea {
          flex: 1;
          resize: none;
          border: 1px solid hsl(var(--border));
          border-radius: 0.5rem;
          padding: 0.5rem 0.75rem;
          font-size: 0.8125rem;
          background: hsl(var(--background));
          color: hsl(var(--foreground));
          outline: none;
          max-height: 6rem;
          font-family: inherit;
          line-height: 1.5;
        }
        .ac-textarea:focus { border-color: hsl(var(--ring)); }
        .ac-send-btn {
          width: 2rem;
          height: 2rem;
          border-radius: 0.375rem;
          background: hsl(var(--primary));
          color: hsl(var(--primary-foreground));
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
          color: hsl(var(--muted-foreground));
        }
        .ac-start-btn {
          padding: 0.5rem 1.25rem;
          border-radius: 0.5rem;
          background: hsl(var(--primary));
          color: hsl(var(--primary-foreground));
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
          color: hsl(var(--muted-foreground));
          padding: 0.25rem;
          display: flex;
          align-items: center;
        }
        .ac-icon-btn:hover { color: hsl(var(--foreground)); }
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
              <span className="ac-header-title">Claude</span>
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
                <div className="ac-messages">
                  {messages.map((msg) => {
                    const isAck = !!(msg.metadata as { isAck?: boolean })
                      ?.isAck;
                    const isProgress = !!(
                      msg.metadata as { isProgress?: boolean }
                    )?.isProgress;
                    return (
                      <div
                        key={msg.id}
                        className={`ac-msg ac-msg-${msg.role}${isAck ? " ac-msg-ack" : ""}${isProgress ? " ac-msg-progress" : ""}`}
                        dangerouslySetInnerHTML={{
                          __html:
                            msg.role === "assistant"
                              ? renderMarkdown(msg.content)
                              : msg.content.replace(/</g, "&lt;"),
                        }}
                      />
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
                <div className="ac-input-area">
                  <textarea
                    className="ac-textarea"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={
                      sessionActive
                        ? "Ask anything..."
                        : "Session ended — start a new one"
                    }
                    disabled={!sessionActive || sending}
                    rows={1}
                  />
                  <button
                    className="ac-send-btn"
                    onClick={() => void sendMessage()}
                    disabled={
                      !sessionActive || sending || input.trim().length === 0
                    }
                  >
                    {sending ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Send size={14} />
                    )}
                  </button>
                </div>
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
