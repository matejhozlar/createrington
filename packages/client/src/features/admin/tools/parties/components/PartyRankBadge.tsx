import { Crown, Shield, User, type LucideIcon } from "lucide-react";
import type { PartyMemberRank } from "@createrington/shared/party";
import { Badge, type BadgeTone } from "@/components/ui/badge";

const RANKS: Record<
  PartyMemberRank,
  { label: string; icon: LucideIcon; tone?: BadgeTone; className?: string }
> = {
  owner: { label: "Owner", icon: Crown, tone: "warning" },
  officer: { label: "Officer", icon: Shield, tone: "info" },
  member: {
    label: "Member",
    icon: User,
    className: "border-transparent bg-foreground/10 text-foreground/80",
  },
};

export function PartyRankBadge({ rank }: { rank: PartyMemberRank }) {
  const { label, icon: Icon, tone, className } = RANKS[rank];
  return (
    <Badge variant="outline" tone={tone} className={className}>
      <Icon className="size-3" />
      {label}
    </Badge>
  );
}
