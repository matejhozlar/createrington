import { useState } from "react";
import { Bot, Check, Copy, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { coerceAction, parseActionsFromMessage } from "./actions";
import { ActionCard } from "./ActionCard";
import { AssistantMarkdown } from "./AssistantMarkdown";
import type { ChatMessage } from "./types";

interface MessageRowProps {
  message: ChatMessage;
  navigate: (to: string) => void;
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function MessageRow({
  message,
  navigate,
}: MessageRowProps): React.JSX.Element {
  const isAck = message.kind === "ack";
  const isProgress = message.kind === "progress";
  const isStreaming = message.kind === "streaming";
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);

  // Legacy fence-parsed actions — kept as a transitional fallback for
  // messages written before MCP migration. Don't run the parser on
  // half-streaming content; wait until the stream settles so the fence
  // isn't truncated.
  const { content, actions: fenceActions } =
    !isUser && !isStreaming
      ? parseActionsFromMessage(message.content)
      : { content: message.content, actions: [] };
  const persistedActions = message.actions ?? [];

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard may be unavailable (insecure context) — silent no-op
    }
  };

  return (
    <div
      className={cn(
        "group flex flex-col gap-1.5",
        isUser ? "items-end" : "items-start",
      )}
    >
      <div
        className={cn(
          "flex max-w-full items-end gap-2",
          isUser && "flex-row-reverse",
        )}
      >
        <div
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-full",
            isUser
              ? "bg-primary/15 text-primary"
              : "bg-muted text-muted-foreground",
          )}
          aria-hidden
        >
          {isUser ? <User size={14} /> : <Bot size={14} />}
        </div>
        <div
          className={cn(
            "max-w-[85%] rounded-lg px-3 py-2 text-[0.8125rem] leading-relaxed break-words",
            isUser
              ? "rounded-br-sm bg-primary text-primary-foreground"
              : "rounded-bl-sm bg-muted text-foreground",
            isAck && "text-xs italic opacity-60",
            isProgress && "text-xs opacity-50",
            isStreaming &&
              "after:ml-0.5 after:inline-block after:h-3.5 after:w-0.5 after:animate-pulse after:bg-current after:align-middle",
          )}
          title={formatTime(message.createdAt)}
        >
          {isUser ? (
            content
          ) : (
            <AssistantMarkdown text={content} navigate={navigate} />
          )}
        </div>
      </div>

      {!isUser && !isStreaming && content.length > 0 && (
        <div
          className={cn(
            "flex items-center gap-2 pl-8 text-[0.625rem] text-muted-foreground",
            "opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100",
          )}
        >
          <span>{formatTime(message.createdAt)}</span>
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="inline-flex items-center gap-1 rounded px-1 py-0.5 hover:bg-muted hover:text-foreground"
            aria-label="Copy message"
          >
            {copied ? (
              <>
                <Check size={10} />
                Copied
              </>
            ) : (
              <>
                <Copy size={10} />
                Copy
              </>
            )}
          </button>
        </div>
      )}

      <div
        className={cn(
          "flex w-full flex-col gap-1.5",
          isUser ? "items-end" : "items-start",
        )}
      >
        {persistedActions.map((record) => {
          const coerced = coerceAction(record.payload);
          if (!coerced) return null;
          return (
            <ActionCard
              key={`db-${record.id}`}
              action={coerced}
              storageKey={`db-${record.id}`}
              navigate={navigate}
            />
          );
        })}
        {fenceActions.map((action, i) => (
          <ActionCard
            key={`fence-${message.id}:${i}`}
            action={action}
            storageKey={`fence-${message.id}:${i}`}
            navigate={navigate}
          />
        ))}
      </div>
    </div>
  );
}
