import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChatHeader } from "./ChatHeader";
import { EmptyState } from "./EmptyState";
import { MessageInput } from "./MessageInput";
import { MessageList } from "./MessageList";
import type { AdminChatModel, ChatMessage } from "./types";

interface ChatPanelProps {
  pathname: string;
  messages: ChatMessage[];
  sessionId: number | null;
  sessionActive: boolean;
  activeModel: AdminChatModel | null;
  selectedModel: AdminChatModel;
  onSelectModel: (model: AdminChatModel) => void;
  starting: boolean;
  sending: boolean;
  awaitingReply: boolean;
  onStart: (prefillMessage?: string, model?: AdminChatModel) => void;
  onSend: (message: string) => void;
  onEnd: () => void;
  onClose: () => void;
  navigate: (to: string) => void;
}

export function ChatPanel({
  pathname,
  messages,
  sessionId,
  sessionActive,
  activeModel,
  selectedModel,
  onSelectModel,
  starting,
  sending,
  awaitingReply,
  onStart,
  onSend,
  onEnd,
  onClose,
  navigate,
}: ChatPanelProps): React.JSX.Element {
  const [input, setInput] = useState("");
  const [expanded, setExpanded] = useState(false);

  const handleSend = (): void => {
    if (!input.trim()) return;
    onSend(input);
    setInput("");
  };

  const showEmpty = !sessionId || (!sessionActive && messages.length === 0);

  return (
    <div
      className={cn(
        "fixed right-5 bottom-20 z-[9999] flex max-h-[calc(100vh-7rem)] w-96 max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl",
        "animate-in fade-in slide-in-from-bottom-4 duration-200",
        expanded && "h-[calc(100vh-7rem)] w-[32rem] max-w-[calc(100vw-2.5rem)]",
        !expanded && "h-[32rem]",
      )}
    >
      <ChatHeader
        breadcrumb={pathname}
        sessionActive={sessionActive}
        canStartNew={sessionId !== null && !sessionActive}
        expanded={expanded}
        activeModel={activeModel}
        selectedModel={selectedModel}
        onSelectModel={onSelectModel}
        hasHistory={messages.length > 0}
        onStartWithModel={(model) => onStart(undefined, model)}
        onNewChat={() => onStart()}
        onEndSession={onEnd}
        onToggleExpand={() => setExpanded((v) => !v)}
        onClose={onClose}
      />

      {showEmpty ? (
        <EmptyState starting={starting} onStart={onStart} />
      ) : (
        <>
          <MessageList
            messages={messages}
            awaitingReply={awaitingReply}
            navigate={navigate}
          />
          {sessionActive ? (
            <MessageInput
              value={input}
              onChange={setInput}
              onSubmit={handleSend}
              sending={sending}
            />
          ) : (
            <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border px-3 py-2.5">
              <span className="text-xs text-muted-foreground">
                Session ended
              </span>
              <Button size="sm" onClick={() => onStart()} disabled={starting}>
                {starting && <Loader2 size={14} className="animate-spin" />}
                Start new chat
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
