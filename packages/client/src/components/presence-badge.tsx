import { Badge, type BadgeTone } from "@/components/ui/badge";

type Presence = "online" | "offline" | "maintenance";

const PRESENCE: Record<Presence, { label: string; tone?: BadgeTone }> = {
  online: { label: "Online", tone: "success" },
  maintenance: { label: "Maintenance", tone: "warning" },
  offline: { label: "Offline" },
};

export function PresenceBadge({
  status,
  className,
  children,
}: {
  status: Presence;
  className?: string;
  children?: React.ReactNode;
}) {
  const { label, tone } = PRESENCE[status];

  return (
    <Badge variant="outline" tone={tone} className={className}>
      {children ?? label}
    </Badge>
  );
}
