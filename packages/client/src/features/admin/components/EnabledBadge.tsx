import { Badge } from "@/components/ui/badge";

export function EnabledBadge({
  enabled,
  className,
}: {
  enabled: boolean;
  className?: string;
}) {
  return (
    <Badge tone={enabled ? "success" : "neutral"} className={className}>
      {enabled ? "Enabled" : "Disabled"}
    </Badge>
  );
}
