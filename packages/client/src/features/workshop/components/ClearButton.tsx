import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ClearButton({
  onClick,
  className,
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      aria-label="Clear search"
      onClick={(event) => {
        onClick();
        event.currentTarget.closest("div")?.querySelector("input")?.focus();
      }}
      className={cn(
        "absolute top-1/2 -translate-y-1/2 text-muted-foreground hover:bg-transparent hover:text-foreground dark:hover:bg-transparent",
        className,
      )}
    >
      <X />
    </Button>
  );
}
