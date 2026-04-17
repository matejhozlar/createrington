import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { useAuth } from "@/contexts/auth";
import { mcHeadsAvatar } from "@/lib/external-urls";
import { cn } from "@/lib/utils";
import { coerceAction, parseActionsFromMessage } from "./actions";
import { ActionCard } from "./ActionCard";
import { AssistantMarkdown } from "./AssistantMarkdown";
import type { ChatMessage } from "./types";

interface MessageRowProps {
  message: ChatMessage;
  navigate: (to: string) => void;
  /** True when this message is the last in a same-author run — the avatar
   * only renders on this one to tighten grouped bubbles. */
  showAvatar: boolean;
  /** True when the previous message had a different author. Adds extra
   * breathing room above to visually separate turns. */
  isGroupStart: boolean;
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
  showAvatar,
  isGroupStart,
}: MessageRowProps): React.JSX.Element {
  const { user } = useAuth();
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

  const handleCopy = async (
    e: React.MouseEvent<HTMLButtonElement>,
  ): Promise<void> => {
    // Release focus so the hover-to-reveal meta row (which also opens
    // on focus-within for keyboard users) fades back out once the
    // cursor leaves. Without this, focus lingers on the copy button
    // after click and the row stays pinned open.
    e.currentTarget.blur();
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard may be unavailable (insecure context) — silent no-op
    }
  };

  const showMeta = !isStreaming && !isAck && !isProgress && content.length > 0;
  const hasActions = persistedActions.length > 0 || fenceActions.length > 0;

  return (
    <div
      className={cn(
        "group flex flex-col",
        isUser ? "items-end" : "items-start",
        isGroupStart ? "mt-2 first:mt-0" : "mt-0",
        !showMeta && "mb-1.5",
      )}
    >
      <div
        className={cn(
          "flex max-w-full items-end gap-2",
          isUser && "flex-row-reverse",
        )}
      >
        {showAvatar ? (
          isUser ? (
            <img
              src={user?.minecraftUuid ? mcHeadsAvatar(user.minecraftUuid) : ""}
              alt={user?.minecraftUsername ?? "You"}
              className="size-6 shrink-0 rounded bg-muted object-cover"
              loading="lazy"
            />
          ) : (
            <img
              src="/assets/logo/createrington-bot.webp"
              alt="Createrington"
              className="size-6 shrink-0 rounded-full bg-muted object-cover"
              loading="lazy"
            />
          )
        ) : (
          <div className="size-6 shrink-0" aria-hidden />
        )}
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

      {showMeta && (
        <div
          className={cn(
            "mt-0.5 flex items-center gap-1.5 text-[0.625rem] text-muted-foreground opacity-0 transition-opacity duration-100",
            "group-hover:opacity-100 focus-within:opacity-100",
            isUser ? "flex-row-reverse pr-8" : "pl-8",
          )}
        >
          <span>{formatTime(message.createdAt)}</span>
          <button
            type="button"
            onClick={(e) => void handleCopy(e)}
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

      {hasActions && (
        <div
          className={cn(
            "mt-1.5 flex w-full flex-col gap-1.5",
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
      )}
    </div>
  );
}
