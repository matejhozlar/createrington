import { Sparkles } from "lucide-react";
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

interface ModelChipProps {
  value: AdminChatModel;
  onChange?: (next: AdminChatModel) => void;
  /**
   * Read-only mode renders the chip as a static badge — used for the
   * "currently answering with X" indicator while a session is active, where
   * the model is pinned for the lifetime of the session.
   */
  readOnly?: boolean;
  disabled?: boolean;
  /** Tooltip override; sensible defaults are used when omitted. */
  tooltip?: string;
  className?: string;
}

/**
 * Subtle pill that shows the current model and (when interactive) lets the
 * admin switch the preference. Used in the empty state, the session-ended
 * footer, and as a read-only indicator above the message input.
 */
export function ModelChip({
  value,
  onChange,
  readOnly = false,
  disabled = false,
  tooltip,
  className,
}: ModelChipProps): React.JSX.Element {
  const label = ADMIN_CHAT_MODEL_LABELS[value];
  const interactive = !readOnly && onChange !== undefined;

  const triggerClass = cn(
    "h-6 gap-1 rounded-full border border-border/60 bg-muted/40 px-2 text-[0.6875rem] font-medium text-muted-foreground shadow-none transition-colors",
    interactive && "hover:bg-muted hover:text-foreground",
    !interactive && "cursor-default",
    className,
  );

  if (!interactive) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={triggerClass}>
            <Sparkles size={11} className="opacity-70" />
            {label}
          </span>
        </TooltipTrigger>
        <TooltipContent className="z-[10000]">
          {tooltip ?? `Replying with ${label}`}
        </TooltipContent>
      </Tooltip>
    );
  }

  const handleChange = (raw: string): void => {
    if (!isAdminChatModel(raw) || raw === value) return;
    onChange?.(raw);
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Select value={value} onValueChange={handleChange} disabled={disabled}>
          <SelectTrigger
            size="sm"
            aria-label="Model for next chat"
            className={triggerClass}
          >
            <Sparkles size={11} className="opacity-70" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="z-[10000]" align="center">
            {ADMIN_CHAT_MODELS.map((m) => (
              <SelectItem key={m} value={m} className="text-xs">
                {ADMIN_CHAT_MODEL_LABELS[m]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TooltipTrigger>
      <TooltipContent className="z-[10000]">
        {tooltip ?? "Model for next chat"}
      </TooltipContent>
    </Tooltip>
  );
}
