import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MessageRow } from "./MessageRow";
import { TypingIndicator } from "./TypingIndicator";
import { readingColumnClass, type ChatLayout } from "../layout";
import type { ChatMessage } from "../types";

const NEAR_BOTTOM_PX = 64;
const AT_BOTTOM_PX = 4;

interface MessageListProps {
  messages: ChatMessage[];
  /** Whether a send is in-flight but no assistant content has arrived yet. */
  awaitingReply: boolean;
  navigate: (to: string) => void;
  layout: ChatLayout;
}

function distanceFromBottom(el: HTMLDivElement): number {
  return el.scrollHeight - el.scrollTop - el.clientHeight;
}

function pinToBottom(
  el: HTMLDivElement,
  pinnedTop: React.RefObject<number | null>,
): void {
  const before = el.scrollTop;
  el.scrollTop = el.scrollHeight;
  pinnedTop.current = el.scrollTop === before ? null : el.scrollTop;
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
  const nearBottomRef = useRef(true);
  const atBottomRef = useRef(true);
  const pinnedTopRef = useRef<number | null>(null);
  const smoothScrollingRef = useRef(false);
  const [pinnedToBottom, setPinnedToBottom] = useState(true);

  const syncPosition = (el: HTMLDivElement): void => {
    const dist = distanceFromBottom(el);
    nearBottomRef.current = dist < NEAR_BOTTOM_PX;
    atBottomRef.current = dist < AT_BOTTOM_PX;
    setPinnedToBottom(dist < NEAR_BOTTOM_PX);
  };

  const scrollToBottom = (behavior: ScrollBehavior = "smooth"): void => {
    const el = scrollRef.current;
    if (!el) return;
    if (behavior !== "smooth") {
      pinToBottom(el, pinnedTopRef);
      return;
    }
    if (distanceFromBottom(el) < AT_BOTTOM_PX) return;
    smoothScrollingRef.current = true;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  };

  // Track whether the user is near the bottom. 64px tolerance so a small
  // drift (e.g. an expanding code block) doesn't flip to "scrolled up".
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = (): void => {
      const pinnedTop = pinnedTopRef.current;
      pinnedTopRef.current = null;
      if (pinnedTop !== null && Math.abs(el.scrollTop - pinnedTop) < 1) return;
      if (smoothScrollingRef.current) {
        if (distanceFromBottom(el) >= AT_BOTTOM_PX) return;
        smoothScrollingRef.current = false;
      }
      syncPosition(el);
    };
    const onScrollEnd = (): void => {
      smoothScrollingRef.current = false;
      syncPosition(el);
    };
    const onUserScroll = (): void => {
      smoothScrollingRef.current = false;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("scrollend", onScrollEnd);
    el.addEventListener("wheel", onUserScroll, { passive: true });
    el.addEventListener("touchmove", onUserScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("scrollend", onScrollEnd);
      el.removeEventListener("wheel", onUserScroll);
      el.removeEventListener("touchmove", onUserScroll);
    };
  }, []);

  useEffect(() => {
    if (nearBottomRef.current || smoothScrollingRef.current) {
      scrollToBottom("smooth");
    }
  }, [messages, awaitingReply]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let last: { width: number; height: number } | null = null;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const changed =
        last !== null && (last.width !== width || last.height !== height);
      last = { width, height };
      if (!changed) return;
      if (atBottomRef.current) pinToBottom(el, pinnedTopRef);
      else syncPosition(el);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && atBottomRef.current) pinToBottom(el, pinnedTopRef);
  }, [layout]);

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
