import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router";
import {
  endSession as endSessionRequest,
  fetchChatMessages,
  fetchSessionStatus,
  runStream,
  sendChatMessage,
  startSession,
} from "../api";
import type { ChatActionRecord } from "../actions";
import {
  isAdminChatModel,
  type AdminChatModel,
  type ChatMessage,
  type PageContext,
} from "../types";

interface UseAdminChatSessionArgs {
  isAdmin: boolean;
  open: boolean;
}

interface UseAdminChatSessionResult {
  sessionId: number | null;
  sessionActive: boolean;
  activeModel: AdminChatModel | null;
  messages: ChatMessage[];
  starting: boolean;
  sending: boolean;
  awaitingReply: boolean;
  start: (prefillMessage?: string, model?: AdminChatModel) => Promise<void>;
  send: (message: string) => Promise<void>;
  end: () => Promise<void>;
}

export function useAdminChatSession({
  isAdmin,
  open,
}: UseAdminChatSessionArgs): UseAdminChatSessionResult {
  const location = useLocation();
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [sessionActive, setSessionActive] = useState(false);
  const [activeModel, setActiveModel] = useState<AdminChatModel | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [starting, setStarting] = useState(false);
  const [sending, setSending] = useState(false);
  const [awaitingReply, setAwaitingReply] = useState(false);

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

  useEffect(() => {
    if (!open || !isAdmin) return;
    fetchSessionStatus()
      .then((data) => {
        const nextId = data.active ? data.sessionId : data.lastSessionId;
        if (!nextId) return;
        setSessionId((prev) => {
          if (prev !== nextId) setMessages([]);
          return nextId;
        });
        setSessionActive(Boolean(data.active));
        const reportedModel = data.active ? data.model : data.lastSessionModel;
        setActiveModel(isAdminChatModel(reportedModel) ? reportedModel : null);
      })
      .catch(console.error);
  }, [open, isAdmin]);

  const mergeMessages = useCallback((incoming: ChatMessage[]): void => {
    if (incoming.length === 0) return;
    setMessages((prev) => {
      const byId = new Map<number, ChatMessage>(
        prev.map((m) => [m.id, m] as const),
      );
      for (const m of incoming) {
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
    if (incoming.some((m) => m.role === "assistant" && m.content.length > 0)) {
      setAwaitingReply(false);
    }
  }, []);

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

  useEffect(() => {
    if (!sessionId || !open) return;
    const abort = new AbortController();
    let cancelled = false;

    void (async (): Promise<void> => {
      try {
        const data = await fetchChatMessages(sessionId);
        if (cancelled) return;
        if (data.messages) mergeMessages(data.messages);
        if (data.sessionActive !== undefined) {
          setSessionActive(data.sessionActive);
        }
      } catch {}

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
      } catch (error) {
        if ((error as { name?: string }).name !== "AbortError") {
          console.error("[admin-chat] stream error:", error);
        }
      }
    })();

    return () => {
      cancelled = true;
      abort.abort();
    };
  }, [sessionId, open, mergeMessages, attachAction]);

  const start = useCallback(
    async (prefillMessage?: string, model?: AdminChatModel): Promise<void> => {
      if (!isAdmin) return;
      setStarting(true);
      try {
        const data = await startSession({
          pageContext: pageContext("admin-chat"),
          ...(model && { model }),
        });
        if (!data.sessionId) return;
        setSessionId(data.sessionId);
        setSessionActive(true);
        setActiveModel(isAdminChatModel(data.model) ? data.model : null);
        setMessages([]);
        if (prefillMessage) {
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
            void sendChatMessage({
              sessionId: data.sessionId,
              message: trimmed,
              pageContext: pageContext("admin-chat"),
            }).catch((err) => {
              console.error("[admin-chat] Failed to send prefill:", err);
              setAwaitingReply(false);
            });
          }
        }
      } catch (error) {
        console.error("[admin-chat] Failed to start session:", error);
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
        await sendChatMessage({
          sessionId,
          message: trimmed,
          pageContext: pageContext(
            location.pathname.startsWith("/admin") ? "admin" : "page",
          ),
        });
      } catch (error) {
        console.error("[admin-chat] Failed to send message:", error);
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
      await endSessionRequest(sessionId);
      setSessionActive(false);
    } catch (error) {
      console.error("[admin-chat] Failed to end session:", error);
    }
  }, [sessionId]);

  return {
    sessionId,
    sessionActive,
    activeModel,
    messages,
    starting,
    sending,
    awaitingReply,
    start,
    send,
    end,
  };
}
