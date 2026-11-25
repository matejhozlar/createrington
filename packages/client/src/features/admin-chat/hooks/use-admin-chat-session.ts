import { useCallback, useEffect, useState } from "react";
import { skipToken, useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router";
import type {
  AdminChatModel,
  ChatActionRecord,
  ChatMessage,
} from "@createrington/shared/admin-chat";
import { useToastActions } from "@/hooks/use-toast";
import { queryClient, trpc } from "@/lib/trpc";
import { keepStreamOpen } from "../stream";
import type { PageContext } from "../types";

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

const NO_MESSAGES: ChatMessage[] = [];

function sessionKey() {
  return trpc.admin.chat.sessions.current.queryKey();
}

function transcriptKey(sessionId: number) {
  return trpc.admin.chat.messages.list.queryKey({ sessionId });
}

function setSessionActive(sessionId: number, active: boolean): void {
  queryClient.setQueryData(sessionKey(), (prev) =>
    prev && prev.id === sessionId ? { ...prev, active } : prev,
  );
}

function updateMessages(
  sessionId: number,
  update: (prev: ChatMessage[]) => ChatMessage[],
): void {
  queryClient.setQueryData(transcriptKey(sessionId), (prev) => ({
    sessionActive: prev?.sessionActive ?? true,
    messages: update(prev?.messages ?? []),
  }));
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
  const [awaitingReply, setAwaitingReply] = useState(false);

  const { mutateAsync: startSession, isPending: starting } = useMutation(
    trpc.admin.chat.sessions.start.mutationOptions(),
  );
  const { mutateAsync: sendMessage, isPending: sending } = useMutation(
    trpc.admin.chat.messages.send.mutationOptions(),
  );
  const { mutateAsync: endSession } = useMutation(
    trpc.admin.chat.sessions.end.mutationOptions(),
  );

  const sessionQuery = useQuery(
    trpc.admin.chat.sessions.current.queryOptions(undefined, {
      enabled: open && isAdmin,
      staleTime: 0,
    }),
  );
  const sessionId = sessionQuery.data?.id ?? null;

  const transcriptOptions = trpc.admin.chat.messages.list.queryOptions(
    sessionId !== null ? { sessionId } : skipToken,
    { enabled: open, staleTime: 0 },
  );
  const fetchTranscript = transcriptOptions.queryFn;
  const historyQuery = useQuery({
    ...transcriptOptions,
    queryFn:
      sessionId === null || typeof fetchTranscript !== "function"
        ? skipToken
        : async (context) => {
            const data = await fetchTranscript(context);
            setSessionActive(sessionId, data.sessionActive);
            if (hasAssistantReply(data.messages)) setAwaitingReply(false);
            return {
              ...data,
              messages: mergeMessages(
                queryClient.getQueryData(transcriptKey(sessionId))?.messages ??
                  [],
                data.messages,
              ),
            };
          },
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

  const sessionActive = sessionQuery.data?.active ?? false;

  useEffect(() => {
    if (sessionId === null || !sessionActive) return;
    const abort = new AbortController();

    void keepStreamOpen(
      sessionId,
      {
        onMessage: (m) => {
          updateMessages(sessionId, (prev) => mergeMessages(prev, [m]));
          if (hasAssistantReply([m])) setAwaitingReply(false);
        },
        onAction: (record) =>
          updateMessages(sessionId, (prev) => attachAction(prev, record)),
        onSessionEnded: () => {
          setSessionActive(sessionId, false);
          setAwaitingReply(false);
        },
        onReconnect: () =>
          void queryClient.invalidateQueries({
            queryKey: transcriptKey(sessionId),
          }),
        onLost: () => toast.error("Lost connection to the assistant"),
      },
      abort.signal,
    );

    return () => abort.abort();
  }, [sessionId, sessionActive, toast]);

  const start = useCallback(
    async (prefillMessage?: string): Promise<void> => {
      if (!isAdmin) return;
      setAwaitingReply(false);
      try {
        const { sessionId: id, model } = await startSession({
          pageContext: pageContext("admin-chat"),
        });
        const prefill = prefillMessage?.trim();
        const optimistic = prefill ? optimisticUserMessage(prefill) : null;
        await queryClient.cancelQueries({ queryKey: sessionKey() });
        queryClient.setQueryData(transcriptKey(id), {
          messages: optimistic ? [optimistic] : [],
          sessionActive: true,
        });
        queryClient.setQueryData(sessionKey(), { id, active: true, model });
        if (!optimistic) return;
        setAwaitingReply(true);
        sendMessage({
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
      }
    },
    [isAdmin, pageContext, startSession, sendMessage, toast],
  );

  const send = useCallback(
    async (message: string): Promise<void> => {
      const trimmed = message.trim();
      if (!trimmed || sessionId === null) return;
      const optimistic = optimisticUserMessage(trimmed);
      updateMessages(sessionId, (prev) => [...prev, optimistic]);
      setAwaitingReply(true);
      try {
        await sendMessage({
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
      }
    },
    [sessionId, pageContext, location.pathname, sendMessage, toast],
  );

  const end = useCallback(async (): Promise<void> => {
    if (sessionId === null) return;
    try {
      await endSession({ sessionId });
      setSessionActive(sessionId, false);
      setAwaitingReply(false);
    } catch {
      toast.error("Couldn't end the chat");
    }
  }, [sessionId, endSession, toast]);

  return {
    sessionId,
    sessionActive,
    activeModel: sessionQuery.data?.model ?? null,
    messages: historyQuery.data?.messages ?? NO_MESSAGES,
    starting,
    sending,
    awaitingReply,
    start,
    send,
    end,
  };
}
