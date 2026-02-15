import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useIsMobile } from "@/hooks/use-mobile";
import { SkinViewer } from "./SkinViewer";
import type { TeamMember } from "../data";
import { TIER_CONFIG } from "../data";

type TeamMemberCardProps = {
  member: TeamMember;
  index: number;
  total: number;
  onClick: () => void;
};

export const TeamMemberCard = ({ member, index, total, onClick }: TeamMemberCardProps) => {
  const isMobile = useIsMobile();
  const config = TIER_CONFIG[member.tier];
  const size = isMobile ? config.size.mobile : config.size.desktop;

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-2 transition-transform duration-300 md:hover:scale-105 cursor-pointer opacity-0"
      style={{
        animation: "fade-in-up 0.5s ease-out forwards",
        animationDelay: `${index * 100}ms`,
      }}
    >
      <SkinViewer
        uuid={member.uuid}
        username={member.username}
        width={size.width}
        height={size.height}
        hoverAnimation={isMobile ? undefined : member.hoverAnimation}
        index={index}
        total={total}
      />

      <div className="flex flex-col items-center gap-1">
        <span className="text-foreground font-semibold text-xs md:text-sm">
          {member.username}
        </span>

        <Badge
          variant="outline"
          className={cn("text-[10px] md:text-xs", config.badgeClass)}
        >
          {member.role}
        </Badge>
      </div>
    </button>
  );
};
