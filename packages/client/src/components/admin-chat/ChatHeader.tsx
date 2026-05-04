import { Maximize2, Minimize2, Plus, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  ADMIN_CHAT_MODELS,
  ADMIN_CHAT_MODEL_LABELS,
  isAdminChatModel,
  type AdminChatModel,
} from "./types";

interface ChatHeaderProps {
  breadcrumb: string;
  sessionActive: boolean;
  canStartNew: boolean;
  expanded: boolean;
  /** Model the active (or last) session is pinned to. `null` for legacy sessions. */
  activeModel: AdminChatModel | null;
  /** Admin's saved model preference — used as the default for the next session. */
  selectedModel: AdminChatModel;
  onSelectModel: (model: AdminChatModel) => void;
  hasHistory: boolean;
  /** Confirm-and-start a new session with the chosen model (used when switching mid-history). */
  onStartWithModel: (model: AdminChatModel) => void;
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
  activeModel,
  selectedModel,
  onSelectModel,
  hasHistory,
  onStartWithModel,
  onNewChat,
  onEndSession,
  onToggleExpand,
  onClose,
}: ChatHeaderProps): React.JSX.Element {
  // While a session is active, the picker reflects the model it's pinned to
  // (read-only badge). Otherwise it shows the admin's saved preference,
  // which becomes the default for the next session.
  const pickerValue: AdminChatModel =
    sessionActive && activeModel ? activeModel : selectedModel;

  const handleModelChange = (raw: string): void => {
    if (!isAdminChatModel(raw) || raw === pickerValue) return;
    // After a session ended (or nothing's been said yet), there's still
    // visible transcript on screen if hasHistory. Confirm before discarding
    // it for a fresh session on the new model.
    if (hasHistory) {
      const label = ADMIN_CHAT_MODEL_LABELS[raw];
      const ok = window.confirm(
        `Switch to ${label}? This will start a new chat — the current transcript stays in history but the panel will reset.`,
      );
      if (!ok) return;
      onSelectModel(raw);
      onStartWithModel(raw);
      return;
    }
    onSelectModel(raw);
  };

  return (
    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-2">
        <img
          src="/assets/logo/createrington-bot.webp"
          alt="Createrington Assistant"
          className="size-7 shrink-0 rounded-full bg-muted object-cover"
          loading="lazy"
        />
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
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Select
              value={pickerValue}
              onValueChange={handleModelChange}
              disabled={sessionActive}
            >
              <SelectTrigger
                size="sm"
                aria-label="Model"
                className="h-7 gap-1 px-2 text-[0.7rem]"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[10000]">
                {ADMIN_CHAT_MODELS.map((m) => (
                  <SelectItem key={m} value={m} className="text-xs">
                    {ADMIN_CHAT_MODEL_LABELS[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </TooltipTrigger>
          <TooltipContent className="z-[10000]">
            {sessionActive
              ? `Active model — locked for this session`
              : `Model for next session`}
          </TooltipContent>
        </Tooltip>
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
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
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
