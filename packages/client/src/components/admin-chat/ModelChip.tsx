import { useState } from "react";
import { Check, Sparkles } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  ADMIN_CHAT_MODELS,
  ADMIN_CHAT_MODEL_LABELS,
  type AdminChatModel,
} from "./types";

interface ModelChipProps {
  value: AdminChatModel;
  onChange?: (next: AdminChatModel) => void;
  /**
   * Read-only mode renders the chip as a static badge: used for the
   * "currently answering with X" indicator while a session is active, where
   * the model is pinned for the lifetime of the session.
   */
  readOnly?: boolean;
  disabled?: boolean;
  /** Tooltip override; sensible defaults are used when omitted. */
  tooltip?: string;
  className?: string;
}

export function ModelChip({
  value,
  onChange,
  readOnly = false,
  disabled = false,
  tooltip,
  className,
}: ModelChipProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const label = ADMIN_CHAT_MODEL_LABELS[value];
  const isInteractive = !readOnly && onChange !== undefined;

  const triggerClass = cn(
    "h-6 gap-1 rounded-full border border-border/60 bg-muted/40 px-2 text-[0.6875rem] font-medium text-muted-foreground shadow-none transition-colors inline-flex items-center",
    isInteractive && "hover:bg-muted hover:text-foreground",
    !isInteractive && "cursor-default",
    disabled && "opacity-50 pointer-events-none",
    className,
  );

  if (readOnly || onChange === undefined) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={triggerClass}>
            <Sparkles size={11} className="opacity-70" />
            {label}
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="z-[10000]">
          {tooltip ?? `Replying with ${label}`}
        </TooltipContent>
      </Tooltip>
    );
  }

  const handleSelect = (next: AdminChatModel): void => {
    setOpen(false);
    if (next !== value) onChange(next);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Model for next chat"
              disabled={disabled}
              className={triggerClass}
            >
              <Sparkles size={11} className="opacity-70" />
              {label}
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="z-[10000]">
          {tooltip ?? "Model for next chat"}
        </TooltipContent>
      </Tooltip>
      <PopoverContent
        align="center"
        sideOffset={6}
        className="z-[10000] w-44 p-1"
      >
        <ul role="listbox" className="flex flex-col gap-0.5">
          {ADMIN_CHAT_MODELS.map((m) => {
            const selected = m === value;
            return (
              <li key={m}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => handleSelect(m)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-xs transition-colors",
                    "hover:bg-accent hover:text-accent-foreground",
                    selected && "bg-accent/60 text-foreground",
                  )}
                >
                  <span>{ADMIN_CHAT_MODEL_LABELS[m]}</span>
                  {selected ? <Check size={12} className="opacity-80" /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
