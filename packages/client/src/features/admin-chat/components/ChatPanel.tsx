import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLockBodyScroll } from "@/hooks/use-lock-body-scroll";
import { useVisualViewport } from "@/hooks/use-visual-viewport";
import { cn } from "@/lib/utils";
import { ChatHeader } from "./ChatHeader";
import { EmptyState } from "./EmptyState";
import { MessageInput } from "./MessageInput";
import { MessageList } from "./MessageList";
import { ModelChip } from "./ModelChip";
import { readingColumnClass, type ChatLayout } from "../layout";
import type { AdminChatModel, ChatMessage } from "../types";

const DOCKED_GEOMETRY = {
  "--chat-w": "min(24rem, 100% - 2.5rem)",
  "--chat-h": "min(32rem, 100% - 7rem)",
  "--chat-right": "1.25rem",
  "--chat-bottom": "5rem",
} as React.CSSProperties;

const EXPANDED_WIDTH = "min(64rem, 100% - 4rem)";
const EXPANDED_HEIGHT = "min(60rem, 85%)";
const EXPANDED_GEOMETRY = {
  "--chat-w": EXPANDED_WIDTH,
  "--chat-h": EXPANDED_HEIGHT,
  "--chat-right": `calc((100% - ${EXPANDED_WIDTH}) / 2)`,
  "--chat-bottom": `calc((100% - ${EXPANDED_HEIGHT}) / 2)`,
} as React.CSSProperties;

interface ChatPanelProps {
  pathname: string;
  fullscreen: boolean;
  messages: ChatMessage[];
  sessionId: number | null;
  sessionActive: boolean;
  activeModel: AdminChatModel | null;
  selectedModel: AdminChatModel;
  onSelectModel: (model: AdminChatModel) => void;
  starting: boolean;
  sending: boolean;
  awaitingReply: boolean;
  onStart: (prefillMessage?: string) => void;
  onSend: (message: string) => void;
  onEnd: () => void;
  onClose: () => void;
  navigate: (to: string) => void;
}

export function ChatPanel({
  pathname,
  fullscreen,
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
  const layout: ChatLayout = fullscreen
    ? "fullscreen"
    : expanded
      ? "expanded"
      : "docked";
  const viewport = useVisualViewport();
  useLockBodyScroll(layout === "fullscreen");

  useEffect(() => {
    if (layout !== "expanded") return;
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === "Escape" && !e.defaultPrevented) setExpanded(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [layout]);

  const handleSend = (): void => {
    if (!input.trim()) return;
    onSend(input);
    setInput("");
  };

  const showEmpty = !sessionId || (!sessionActive && messages.length === 0);
  const column = readingColumnClass(layout);

  const panelStyle: React.CSSProperties =
    layout === "fullscreen"
      ? viewport
        ? { top: viewport.offsetTop, height: viewport.height }
        : {}
      : layout === "expanded"
        ? EXPANDED_GEOMETRY
        : DOCKED_GEOMETRY;

  return (
    <>
      {layout !== "fullscreen" && (
        <div
          aria-hidden
          onClick={() => setExpanded(false)}
          className={cn(
            "fixed inset-0 z-10 bg-black/50 transition-opacity duration-300",
            layout === "expanded"
              ? "opacity-100"
              : "pointer-events-none opacity-0",
          )}
        />
      )}
      <div
        style={panelStyle}
        className={cn(
          "fixed z-20 flex flex-col overflow-hidden bg-card",
          "animate-in fade-in slide-in-from-bottom-4 duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
          layout === "fullscreen"
            ? "inset-0"
            : cn(
                "right-(--chat-right) bottom-(--chat-bottom) h-(--chat-h) w-(--chat-w)",
                "rounded-xl border border-border shadow-2xl",
                "transition-[right,bottom,width,height]",
              ),
        )}
      >
        <ChatHeader
          breadcrumb={pathname}
          layout={layout}
          sessionActive={sessionActive}
          canStartNew={sessionId !== null && !sessionActive}
          onNewChat={() => onStart()}
          onEndSession={onEnd}
          onToggleExpand={() => setExpanded((v) => !v)}
          onClose={onClose}
        />

        {showEmpty ? (
          <EmptyState
            starting={starting}
            onStart={onStart}
            selectedModel={selectedModel}
            onSelectModel={onSelectModel}
          />
        ) : (
          <>
            <MessageList
              messages={messages}
              awaitingReply={awaitingReply}
              navigate={navigate}
              layout={layout}
            />
            {sessionActive ? (
              <div className="flex flex-col">
                {activeModel && (
                  <div className="border-t border-border/60 px-3 pt-2">
                    <div className={cn("flex justify-end", column)}>
                      <ModelChip value={activeModel} readOnly />
                    </div>
                  </div>
                )}
                <MessageInput
                  value={input}
                  onChange={setInput}
                  onSubmit={handleSend}
                  sending={sending}
                  layout={layout}
                />
              </div>
            ) : (
              <div className="shrink-0 border-t border-border px-3 py-2.5">
                <div
                  className={cn(
                    "flex items-center justify-between gap-3",
                    column,
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      Session ended
                    </span>
                    <ModelChip
                      value={selectedModel}
                      onChange={onSelectModel}
                      disabled={starting}
                    />
                  </div>
                  <Button
                    size="sm"
                    onClick={() => onStart()}
                    disabled={starting}
                  >
                    {starting && <Loader2 size={14} className="animate-spin" />}
                    Start new chat
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
