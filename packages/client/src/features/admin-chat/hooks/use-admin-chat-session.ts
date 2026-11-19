import { useCallback, useEffect, useState } from "react";
import { skipToken, useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router";
import { useToastActions } from "@/hooks/use-toast";
import { queryClient } from "@/lib/trpc";
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

interface ChatSession {
  id: number | null;
  active: boolean;
  model: AdminChatModel | null;
}

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
  start: (prefillMessage?: string) => Promise<void>;
  send: (message: string) => Promise<void>;
  end: () => Promise<void>;
}

const SESSION_KEY = ["admin-chat", "session"] as const;

const NO_MESSAGES: ChatMessage[] = [];

function messagesKey(sessionId: number | null) {
  return ["admin-chat", "messages", sessionId] as const;
}

async function fetchSession(): Promise<ChatSession> {
  const data = await fetchSessionStatus();
  const model = data.active ? data.model : data.lastSessionModel;
  return {
    id: (data.active ? data.sessionId : data.lastSessionId) ?? null,
    active: Boolean(data.active),
    model: isAdminChatModel(model) ? model : null,
  };
}

function setSessionActive(sessionId: number, active: boolean): void {
  queryClient.setQueryData<ChatSession>(SESSION_KEY, (prev) =>
    prev && prev.id === sessionId ? { ...prev, active } : prev,
  );
}

function updateMessages(
  sessionId: number,
  update: (prev: ChatMessage[]) => ChatMessage[],
): void {
  queryClient.setQueryData<ChatMessage[]>(messagesKey(sessionId), (prev) =>
    update(prev ?? []),
  );
}

function hasAssistantReply(messages: ChatMessage[]): boolean {
  return messages.some((m) => m.role === "assistant" && m.content.length > 0);
}

function optimisticUserMessage(content: string): ChatMessage {
  return {
    id: -Date.now(),
    role: "user",
    content,
    createdAt: new Date().toISOString(),
  };
}

function mergeMessages(
  prev: ChatMessage[],
  incoming: ChatMessage[],
): ChatMessage[] {
  if (incoming.length === 0) return prev;
  const byId = new Map<number, ChatMessage>(
    prev.map((m) => [m.id, m] as const),
  );
  for (const m of incoming) {
    const prior = byId.get(m.id);
    byId.set(
      m.id,
      !m.actions && prior?.actions ? { ...m, actions: prior.actions } : m,
    );
  }
  const incomingUserContent = new Set(
    incoming.filter((m) => m.role === "user").map((m) => m.content),
  );
  const merged = Array.from(byId.values()).filter(
    (m) =>
      !(m.id < 0 && m.role === "user" && incomingUserContent.has(m.content)),
  );
  merged.sort((a, b) => {
    const aOpt = a.id < 0;
    const bOpt = b.id < 0;
    if (aOpt !== bOpt) return aOpt ? 1 : -1;
    if (aOpt) return b.id - a.id;
    return a.id - b.id;
  });
  return merged;
}

function attachAction(
  prev: ChatMessage[],
  record: ChatActionRecord,
): ChatMessage[] {
  let changed = false;
  const next = prev.map((m) => {
    if (m.id !== record.chatMessageId) return m;
    const existing = m.actions ?? [];
    if (existing.some((a) => a.id === record.id)) return m;
    changed = true;
    return { ...m, actions: [...existing, record] };
  });
  return changed ? next : prev;
}

export function useAdminChatSession({
  isAdmin,
  open,
}: UseAdminChatSessionArgs): UseAdminChatSessionResult {
  const location = useLocation();
  const toast = useToastActions();
  const [starting, setStarting] = useState(false);
  const [sending, setSending] = useState(false);
  const [awaitingReply, setAwaitingReply] = useState(false);

  const sessionQuery = useQuery({
    queryKey: SESSION_KEY,
    queryFn: fetchSession,
    enabled: open && isAdmin,
    staleTime: 0,
  });
  const sessionId = sessionQuery.data?.id ?? null;

  const historyQuery = useQuery({
    queryKey: messagesKey(sessionId),
    queryFn:
      sessionId !== null && open
        ? async () => {
            const data = await fetchChatMessages(sessionId);
            setSessionActive(sessionId, data.sessionActive);
            if (hasAssistantReply(data.messages)) setAwaitingReply(false);
            return mergeMessages(
              queryClient.getQueryData<ChatMessage[]>(messagesKey(sessionId)) ??
                [],
              data.messages,
            );
          }
        : skipToken,
    staleTime: 0,
  });

  useEffect(() => {
    if (sessionQuery.error) {
      toast.error("Couldn't load your assistant session");
    }
  }, [sessionQuery.error, toast]);

  useEffect(() => {
    if (historyQuery.error) {
      toast.error("Couldn't load the chat history");
    }
  }, [historyQuery.error, toast]);

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
    if (sessionId === null || !open) return;
    const abort = new AbortController();
    const lostConnection = (): void => {
      toast.error("Lost connection to the assistant");
    };

    runStream(
      sessionId,
      {
        onMessage: (m) => {
          updateMessages(sessionId, (prev) => mergeMessages(prev, [m]));
          if (hasAssistantReply([m])) setAwaitingReply(false);
        },
        onAction: (record) =>
          updateMessages(sessionId, (prev) => attachAction(prev, record)),
        onSessionEnded: () => setSessionActive(sessionId, false),
        onError: lostConnection,
      },
      abort.signal,
    ).catch((error: unknown) => {
      if ((error as { name?: string }).name !== "AbortError") {
        lostConnection();
      }
    });

    return () => abort.abort();
  }, [sessionId, open, toast]);

  const start = useCallback(
    async (prefillMessage?: string): Promise<void> => {
      if (!isAdmin) return;
      setStarting(true);
      try {
        const data = await startSession({
          pageContext: pageContext("admin-chat"),
        });
        if (!data.sessionId) {
          toast.error("Couldn't start a new chat");
          return;
        }
        const id = data.sessionId;
        const prefill = prefillMessage?.trim();
        const optimistic = prefill ? optimisticUserMessage(prefill) : null;
        await queryClient.cancelQueries({ queryKey: SESSION_KEY });
        queryClient.setQueryData<ChatMessage[]>(
          messagesKey(id),
          optimistic ? [optimistic] : [],
        );
        queryClient.setQueryData<ChatSession>(SESSION_KEY, {
          id,
          active: true,
          model: isAdminChatModel(data.model) ? data.model : null,
        });
        if (!optimistic) return;
        setAwaitingReply(true);
        sendChatMessage({
          sessionId: id,
          message: optimistic.content,
          pageContext: pageContext("admin-chat"),
        }).catch(() => {
          toast.error("Couldn't send your message");
          updateMessages(id, (prev) =>
            prev.filter((m) => m.id !== optimistic.id),
          );
          setAwaitingReply(false);
        });
      } catch {
        toast.error("Couldn't start a new chat");
      } finally {
        setStarting(false);
      }
    },
    [isAdmin, pageContext, toast],
  );

  const send = useCallback(
    async (message: string): Promise<void> => {
      const trimmed = message.trim();
      if (!trimmed || sessionId === null) return;
      setSending(true);
      const optimistic = optimisticUserMessage(trimmed);
      updateMessages(sessionId, (prev) => [...prev, optimistic]);
      setAwaitingReply(true);
      try {
        await sendChatMessage({
          sessionId,
          message: trimmed,
          pageContext: pageContext(
            location.pathname.startsWith("/admin") ? "admin" : "page",
          ),
        });
      } catch {
        toast.error("Couldn't send your message");
        updateMessages(sessionId, (prev) =>
          prev.filter((m) => m.id !== optimistic.id),
        );
        setAwaitingReply(false);
      } finally {
        setSending(false);
      }
    },
    [sessionId, pageContext, location.pathname, toast],
  );

  const end = useCallback(async (): Promise<void> => {
    if (sessionId === null) return;
    try {
      await endSessionRequest(sessionId);
      setSessionActive(sessionId, false);
    } catch {
      toast.error("Couldn't end the chat");
    }
  }, [sessionId, toast]);

  return {
    sessionId,
    sessionActive: sessionQuery.data?.active ?? false,
    activeModel: sessionQuery.data?.model ?? null,
    messages: historyQuery.data ?? NO_MESSAGES,
    starting,
    sending,
    awaitingReply,
    start,
    send,
    end,
  };
}
