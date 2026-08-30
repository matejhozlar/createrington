import { useEffect, useRef } from "react";
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

const DOCKED_WIDTH_REM = 24;
const CONTENT_PADDING_X_REM = 0.75;

const DOCKED_GEOMETRY = {
  "--chat-w": `min(${DOCKED_WIDTH_REM}rem, 100% - 2.5rem)`,
  "--chat-h": "min(32rem, 100% - 7rem)",
  "--chat-right": "1.25rem",
  "--chat-bottom": "5rem",
  "--chat-column-w": `${DOCKED_WIDTH_REM - 2 * CONTENT_PADDING_X_REM}rem`,
} as React.CSSProperties;

const DOCKED_GEOMETRY_WITHOUT_LAUNCHER = {
  ...DOCKED_GEOMETRY,
  "--chat-bottom": "1.25rem",
} as React.CSSProperties;

const EXPANDED_WIDTH = "min(64rem, 100% - 4rem)";
const EXPANDED_HEIGHT = "min(60rem, 85%)";
const EXPANDED_GEOMETRY = {
  "--chat-w": EXPANDED_WIDTH,
  "--chat-h": EXPANDED_HEIGHT,
  "--chat-right": `calc((100% - ${EXPANDED_WIDTH}) / 2)`,
  "--chat-bottom": `calc((100% - ${EXPANDED_HEIGHT}) / 2)`,
  "--chat-column-w": "48rem",
} as React.CSSProperties;

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

interface ChatPanelProps {
  pathname: string;
  fullscreen: boolean;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  withLauncher: boolean;
  input: string;
  onInputChange: (value: string) => void;
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
  expanded,
  onExpandedChange,
  withLauncher,
  input,
  onInputChange,
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
  const panelRef = useRef<HTMLDivElement>(null);
  const layout: ChatLayout = fullscreen
    ? "fullscreen"
    : expanded
      ? "expanded"
      : "docked";
  const modal = layout !== "docked";
  const viewport = useVisualViewport();
  useLockBodyScroll(layout === "fullscreen");

  useEffect(() => {
    const previous = document.activeElement;
    const panel = panelRef.current;
    if (panel && !panel.contains(document.activeElement)) {
      panel.focus({ preventScroll: true });
    }
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected) {
        previous.focus({ preventScroll: true });
      }
    };
  }, []);

  useEffect(() => {
    if (layout !== "expanded") return;
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === "Escape" && !e.defaultPrevented) onExpandedChange(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [layout, onExpandedChange]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.key !== "Tab" || !modal) return;
    const focusable = Array.from(
      e.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const handleSend = (): void => {
    if (!input.trim()) return;
    onSend(input);
    onInputChange("");
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
        : withLauncher
          ? DOCKED_GEOMETRY
          : DOCKED_GEOMETRY_WITHOUT_LAUNCHER;

  return (
    <>
      {layout !== "fullscreen" && (
        <div
          aria-hidden
          onClick={() => onExpandedChange(false)}
          className={cn(
            "fixed inset-0 z-10 bg-black/50 transition-opacity duration-300",
            layout === "expanded"
              ? "opacity-100"
              : "pointer-events-none opacity-0",
          )}
        />
      )}
      <div
        ref={panelRef}
        role={modal ? "dialog" : undefined}
        aria-modal={modal || undefined}
        aria-label={modal ? "Createrington Assistant" : undefined}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        style={panelStyle}
        className={cn(
          "fixed z-20 flex flex-col overflow-hidden outline-none",
          "animate-in fade-in slide-in-from-bottom-4 duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
          layout === "fullscreen"
            ? "inset-0 bg-card"
            : cn(
                "right-(--chat-right) bottom-(--chat-bottom) h-(--chat-h) w-(--chat-w)",
                "border shadow-2xl backdrop-blur-2xl",
                "transition-[right,bottom,width,height,border-radius,background-color,border-color]",
                layout === "expanded"
                  ? cn(
                      "rounded-3xl border-white/10 bg-card/60 backdrop-saturate-150",
                      "before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:bg-linear-to-b before:from-white/5 before:to-transparent",
                    )
                  : "rounded-2xl border-border bg-card",
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
          onToggleExpand={() => onExpandedChange(!expanded)}
          onClose={onClose}
        />

        {showEmpty ? (
          <EmptyState
            layout={layout}
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
                  onChange={onInputChange}
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
