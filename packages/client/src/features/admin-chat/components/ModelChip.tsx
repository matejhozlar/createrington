import { Sparkles } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ADMIN_CHAT_MODEL_LABELS, type AdminChatModel } from "../types";

interface ModelChipProps {
  value: AdminChatModel;
  className?: string;
}

export function ModelChip({
  value,
  className,
}: ModelChipProps): React.JSX.Element {
  const label = ADMIN_CHAT_MODEL_LABELS[value];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex h-6 cursor-default items-center gap-1 rounded-full border border-border/60 bg-muted/40 px-2 text-[0.6875rem] font-medium text-muted-foreground",
            className,
          )}
        >
          <Sparkles size={11} className="opacity-70" />
          {label}
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="z-[10000]">
        Replying with {label}
      </TooltipContent>
    </Tooltip>
  );
}
