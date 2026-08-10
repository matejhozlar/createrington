import * as React from "react";
import { Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToastActions } from "@/hooks/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function CellText({
  value,
  display,
  copy = false,
  className,
}: {
  value: string;
  display?: React.ReactNode;
  copy?: boolean;
  className?: string;
}) {
  const toast = useToastActions();
  const textRef = React.useRef<HTMLSpanElement>(null);
  const [clipped, setClipped] = React.useState(false);

  const measure = () => {
    const el = textRef.current;
    if (el) setClipped(el.scrollWidth > el.clientWidth);
  };

  const handleCopy = async (event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  const showValue = clipped || display !== undefined;

  return (
    <Tooltip delayDuration={500} disableHoverableContent>
      <TooltipTrigger asChild>
        {copy ? (
          <button
            type="button"
            onClick={handleCopy}
            onMouseEnter={measure}
            className={cn(
              "group/copy flex min-w-0 max-w-full cursor-pointer items-center gap-1 transition-colors hover:text-foreground",
              className,
            )}
          >
            <span ref={textRef} className="min-w-0 truncate">
              {display ?? value}
            </span>
            <Copy className="size-3 shrink-0 opacity-0 transition-opacity group-hover/copy:opacity-100" />
          </button>
        ) : (
          <span
            ref={textRef}
            onMouseEnter={measure}
            className={cn("block max-w-full truncate", className)}
          >
            {display ?? value}
          </span>
        )}
      </TooltipTrigger>
      {(showValue || copy) && (
        <TooltipContent className="max-w-80">
          {showValue && <p className="break-all">{value}</p>}
          {copy && (
            <p className={showValue ? "text-background/60" : undefined}>
              Click to copy
            </p>
          )}
        </TooltipContent>
      )}
    </Tooltip>
  );
}
