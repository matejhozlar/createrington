import { memo, useEffect, useLayoutEffect } from "react";
import { ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStickToBottom } from "@/hooks/use-stick-to-bottom";
import { cn } from "@/lib/utils";
import { MessageRow } from "./MessageRow";
import { TypingIndicator } from "./TypingIndicator";
import { readingColumnClass, type ChatLayout } from "../layout";
import type { ChatMessage } from "@createrington/shared/admin-chat";

interface MessageListProps {
  messages: ChatMessage[];
  awaitingReply: boolean;
  navigate: (to: string) => void;
  layout: ChatLayout;
}

export const MessageList = memo(function MessageList({
  messages,
  awaitingReply,
  navigate,
  layout,
}: MessageListProps): React.JSX.Element {
  const {
    ref,
    pinnedToBottom,
    scrollToBottom,
    followNewContent,
    keepAtBottom,
  } = useStickToBottom<HTMLDivElement>();

  useEffect(followNewContent, [messages, awaitingReply, followNewContent]);
  useLayoutEffect(keepAtBottom, [layout, keepAtBottom]);

  return (
    <div className="relative flex-1 overflow-hidden">
      <div
        ref={ref}
        className="flex h-full flex-col overflow-y-auto overscroll-contain px-3 py-3"
      >
        <div className={cn("flex flex-col", readingColumnClass(layout))}>
          {messages.map((msg, i) => {
            const prev = messages[i - 1];
            const next = messages[i + 1];
            const isGroupStart = !prev || prev.role !== msg.role;
            const showAvatar = !next || next.role !== msg.role;
            return (
              <MessageRow
                key={msg.id}
                message={msg}
                navigate={navigate}
                showAvatar={showAvatar}
                isGroupStart={isGroupStart}
              />
            );
          })}
          {awaitingReply && <TypingIndicator />}
        </div>
      </div>
      {!pinnedToBottom && (
        <Button
          size="icon-sm"
          variant="secondary"
          onClick={() => scrollToBottom("smooth")}
          className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full shadow-md animate-in fade-in slide-in-from-bottom-2"
          aria-label="Scroll to latest"
        >
          <ArrowDown size={14} />
        </Button>
      )}
    </div>
  );
});
