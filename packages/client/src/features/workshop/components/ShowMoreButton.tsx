import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PAGE_SIZE } from "@/features/workshop/constants";

export function ShowMoreButton({
  remaining,
  onClick,
  className,
}: {
  remaining: number;
  onClick: () => void;
  className?: string;
}) {
  if (remaining <= 0) return null;
  return (
    <div className={cn("flex justify-center", className)}>
      <Button variant="secondary" onClick={onClick}>
        Show {Math.min(remaining, PAGE_SIZE)} more
      </Button>
    </div>
  );
}
