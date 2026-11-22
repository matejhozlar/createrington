import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SourceLinkProps {
  url: string;
  label: string;
  className?: string;
}

export function SourceLink({ url, label, className }: SourceLinkProps) {
  return (
    <Button
      asChild
      variant="ghost"
      size="xs"
      className={cn("text-muted-foreground", className)}
    >
      <a href={url} target="_blank" rel="noreferrer">
        <ExternalLink className="size-3" />
        {label}
      </a>
    </Button>
  );
}
