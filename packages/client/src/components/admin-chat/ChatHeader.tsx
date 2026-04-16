import { Maximize2, Minimize2, Plus, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface ChatHeaderProps {
  breadcrumb: string;
  sessionActive: boolean;
  canStartNew: boolean;
  expanded: boolean;
  onNewChat: () => void;
  onEndSession: () => void;
  onToggleExpand: () => void;
  onClose: () => void;
}

export function ChatHeader({
  breadcrumb,
  sessionActive,
  canStartNew,
  expanded,
  onNewChat,
  onEndSession,
  onToggleExpand,
  onClose,
}: ChatHeaderProps): React.JSX.Element {
  return (
    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2.5">
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">
            Createrington Assistant
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.625rem] font-medium",
              sessionActive
                ? "bg-success/15 text-success"
                : "bg-muted text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "inline-block size-1.5 rounded-full",
                sessionActive
                  ? "animate-pulse bg-success"
                  : "bg-muted-foreground",
              )}
            />
            {sessionActive ? "Active" : "Idle"}
          </span>
        </div>
        <span
          className="max-w-56 overflow-hidden font-mono text-[0.625rem] text-ellipsis whitespace-nowrap text-muted-foreground"
          title={`Current page: ${breadcrumb}`}
        >
          {breadcrumb}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        {canStartNew && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon-xs"
                variant="ghost"
                onClick={onNewChat}
                aria-label="Start new chat"
              >
                <Plus size={14} />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="z-[10000]">New chat</TooltipContent>
          </Tooltip>
        )}
        {sessionActive && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon-xs"
                variant="ghost"
                onClick={onEndSession}
                aria-label="End session"
              >
                <Square size={12} />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="z-[10000]">End session</TooltipContent>
          </Tooltip>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon-xs"
              variant="ghost"
              onClick={onToggleExpand}
              aria-label={expanded ? "Collapse" : "Expand"}
            >
              {expanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </Button>
          </TooltipTrigger>
          <TooltipContent className="z-[10000]">
            {expanded ? "Collapse panel" : "Expand panel"}
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon-xs"
              variant="ghost"
              onClick={onClose}
              aria-label="Close"
            >
              <X size={14} />
            </Button>
          </TooltipTrigger>
          <TooltipContent className="z-[10000]">
            Close (Ctrl+I to hide)
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
