import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useIsMobile } from "@/hooks/use-mobile";
import { SkinViewer, type SkinViewerHandle } from "./SkinViewer";
import type { TeamMember } from "../data";
import { TIER_CONFIG } from "../data";

type TeamMemberCardProps = {
  member: TeamMember;
  index: number;
  total: number;
  onClick: () => void;
}

const AUTO_RESET_MS = 6000;

export function TeamMemberCard({
  member,
  index,
  total,
  onClick,
}: TeamMemberCardProps) {
  const isMobile = useIsMobile();
  const config = TIER_CONFIG[member.tier];
  const size = isMobile ? config.size.mobile : config.size.desktop;

  const skinRef = useRef<SkinViewerHandle>(null);
  const [animationActive, setAnimationActive] = useState(false);
  const timerRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  const handleClick = () => {
    if (!isMobile) {
      onClick();
      return;
    }

    if (!animationActive) {
      skinRef.current?.playAnimation();
      setAnimationActive(true);
      clearTimer();
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        skinRef.current?.stopAnimation();
        setAnimationActive(false);
      }, AUTO_RESET_MS);
    } else {
      clearTimer();
      skinRef.current?.stopAnimation();
      setAnimationActive(false);
      onClick();
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex flex-col items-center gap-2 transition-transform duration-300 md:hover:scale-105 cursor-pointer opacity-0"
      style={{
        animation: "fade-in-up 0.5s ease-out forwards",
        animationDelay: `${index * 100}ms`,
      }}
    >
      <SkinViewer
        ref={skinRef}
        uuid={member.uuid}
        username={member.username}
        width={size.width}
        height={size.height}
        hoverAnimation={member.hoverAnimation}
        enableHover={!isMobile}
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
}
