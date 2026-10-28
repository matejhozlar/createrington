import { Crown, Shield, User, type LucideIcon } from "lucide-react";
import type { PartyMemberRank } from "@createrington/shared/party";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const RANKS: Record<
  PartyMemberRank,
  { label: string; icon: LucideIcon; className: string }
> = {
  owner: {
    label: "Owner",
    icon: Crown,
    className: "border-amber-500/20 bg-amber-500/10 text-amber-400",
  },
  officer: {
    label: "Officer",
    icon: Shield,
    className: "border-sky-500/20 bg-sky-500/10 text-sky-400",
  },
  member: {
    label: "Member",
    icon: User,
    className: "border-transparent bg-foreground/10 text-foreground/80",
  },
};

export function PartyRankBadge({ rank }: { rank: PartyMemberRank }) {
  const { label, icon: Icon, className } = RANKS[rank];
  return (
    <Badge variant="outline" className={cn("gap-1", className)}>
      <Icon className="size-3" />
      {label}
    </Badge>
  );
}
