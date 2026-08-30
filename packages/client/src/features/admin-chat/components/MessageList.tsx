import { useEffect, useRef, useState } from "react";
import { ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MessageRow } from "./MessageRow";
import { TypingIndicator } from "./TypingIndicator";
import { readingColumnClass, type ChatLayout } from "../layout";
import type { ChatMessage } from "../types";

interface MessageListProps {
  messages: ChatMessage[];
  /** Whether a send is in-flight but no assistant content has arrived yet. */
  awaitingReply: boolean;
  navigate: (to: string) => void;
  layout: ChatLayout;
}

/**
 * Scrollable message list with auto-scroll on new content. If the admin
 * has scrolled up to read history, new messages don't yank them down;
 * instead a "jump to latest" pill appears.
 */
export function MessageList({
  messages,
  awaitingReply,
  navigate,
  layout,
}: MessageListProps): React.JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const [pinnedToBottom, setPinnedToBottom] = useState(true);

  const scrollToBottom = (behavior: ScrollBehavior = "smooth"): void => {
    endRef.current?.scrollIntoView({ behavior, block: "end" });
  };

  // Track whether the user is near the bottom. 64px tolerance so a small
  // drift (e.g. an expanding code block) doesn't flip to "scrolled up".
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = (): void => {
      const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
      setPinnedToBottom(dist < 64);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (pinnedToBottom) scrollToBottom("smooth");
  }, [messages, awaitingReply, pinnedToBottom]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !pinnedToBottom) return;
    const observer = new ResizeObserver(() => {
      el.scrollTop = el.scrollHeight;
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [pinnedToBottom]);

  // On first mount, snap to bottom without animation.
  useEffect(() => {
    scrollToBottom("auto");
  }, []);

  return (
    <div className="relative flex-1 overflow-hidden">
      <div
        ref={scrollRef}
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
          <div ref={endRef} />
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
}
