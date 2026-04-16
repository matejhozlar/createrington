import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { claudeFetch, runStream } from "./api";
import type { ChatActionRecord } from "./actions";
import type { ChatMessage, PageContext } from "./types";

interface UseAdminChatSessionArgs {
  isAdmin: boolean;
  open: boolean;
}

interface UseAdminChatSessionResult {
  sessionId: number | null;
  sessionActive: boolean;
  messages: ChatMessage[];
  starting: boolean;
  sending: boolean;
  awaitingReply: boolean;
  start: (prefillMessage?: string) => Promise<void>;
  send: (message: string) => Promise<void>;
  end: () => Promise<void>;
}

/**
 * Encapsulates the admin-chat session lifecycle: feature-flag/session
 * bootstrap, history load, SSE subscription, optimistic send, and
 * end-session. Keeps AdminChat.tsx a thin shell.
 */
export function useAdminChatSession({
  isAdmin,
  open,
}: UseAdminChatSessionArgs): UseAdminChatSessionResult {
  const location = useLocation();
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [sessionActive, setSessionActive] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [starting, setStarting] = useState(false);
  const [sending, setSending] = useState(false);
  const [awaitingReply, setAwaitingReply] = useState(false);

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

  // Check for existing session on drawer open
  useEffect(() => {
    if (!open || !isAdmin) return;
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
  }, [open, isAdmin]);

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
      for (const m of incoming) {
        // SSE message events don't include the actions relation (Prisma
        // update() returns only scalar fields); history load does. When
        // overwriting a message, preserve whatever actions we had if the
        // incoming copy doesn't carry its own.
        const prior = byId.get(m.id);
        const next: ChatMessage = m.actions
          ? m
          : prior?.actions
            ? { ...m, actions: prior.actions }
            : m;
        byId.set(m.id, next);
      }
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
      merged.sort((a, b) => {
        const aOpt = a.id < 0;
        const bOpt = b.id < 0;
        if (aOpt !== bOpt) return aOpt ? 1 : -1;
        if (aOpt) return b.id - a.id;
        return a.id - b.id;
      });
      return merged;
    });
    // Any assistant content arriving clears the awaiting flag.
    if (incoming.some((m) => m.role === "assistant" && m.content.length > 0)) {
      setAwaitingReply(false);
    }
  }, []);

  /**
   * Append a live MCP-tool action record to its parent message (by
   * chatMessageId). Dedupes by record id so an SSE event that races a
   * history refetch doesn't double-render a card.
   */
  const attachAction = useCallback((record: ChatActionRecord): void => {
    setMessages((prev) => {
      let changed = false;
      const next = prev.map((m) => {
        if (m.id !== record.chatMessageId) return m;
        const existing = m.actions ?? [];
        if (existing.some((a) => a.id === record.id)) return m;
        changed = true;
        return { ...m, actions: [...existing, record] };
      });
      return changed ? next : prev;
    });
  }, []);

  // Load history once + open the SSE stream.
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
            onAction: (record) => attachAction(record),
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
  }, [sessionId, open, mergeMessages, attachAction]);

  const start = useCallback(
    async (prefillMessage?: string): Promise<void> => {
      if (!isAdmin) return;
      setStarting(true);
      try {
        const res = await claudeFetch("/start", {
          method: "POST",
          body: JSON.stringify({ pageContext: pageContext("admin-chat") }),
        });
        const data = (await res.json()) as {
          sessionId?: number;
          error?: string;
        };
        if (!data.sessionId) return;
        setSessionId(data.sessionId);
        setSessionActive(true);
        setMessages([]);
        if (prefillMessage) {
          // Optimistic user bubble + fire-and-forget send. The new SSE
          // stream opened by the sessionId effect will pick up the reply.
          const trimmed = prefillMessage.trim();
          if (trimmed) {
            const optimisticId = -Date.now();
            setMessages([
              {
                id: optimisticId,
                role: "user",
                content: trimmed,
                createdAt: new Date().toISOString(),
              },
            ]);
            setAwaitingReply(true);
            void claudeFetch("/send", {
              method: "POST",
              body: JSON.stringify({
                sessionId: data.sessionId,
                message: trimmed,
                pageContext: pageContext("admin-chat"),
              }),
            }).catch((err) => {
              console.error("[admin-chat] Failed to send prefill:", err);
              setAwaitingReply(false);
            });
          }
        }
      } catch (err) {
        console.error("[admin-chat] Failed to start session:", err);
      } finally {
        setStarting(false);
      }
    },
    [isAdmin, pageContext],
  );

  const send = useCallback(
    async (message: string): Promise<void> => {
      const trimmed = message.trim();
      if (!trimmed || !sessionId) return;
      setSending(true);
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
          role: "user",
          content: trimmed,
          createdAt: new Date().toISOString(),
        },
      ]);
      setAwaitingReply(true);
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
        // POST failed — drop the optimistic so the admin doesn't see a
        // ghost message that never actually reached the backend.
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
        setAwaitingReply(false);
      } finally {
        setSending(false);
      }
    },
    [sessionId, pageContext, location.pathname],
  );

  const end = useCallback(async (): Promise<void> => {
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
  }, [sessionId]);

  return {
    sessionId,
    sessionActive,
    messages,
    starting,
    sending,
    awaitingReply,
    start,
    send,
    end,
  };
}
