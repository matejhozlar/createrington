import { Badge } from "@/components/ui/badge";
import { PRESENCE_STYLES, type Presence } from "@/components/presence";

export function PresenceBadge({
  status,
  className,
  children,
}: {
  status: Presence;
  className?: string;
  children?: React.ReactNode;
}) {
  const { label, tone } = PRESENCE_STYLES[status];

  return (
    <Badge variant="outline" tone={tone} className={className}>
      {children ?? label}
    </Badge>
  );
}
