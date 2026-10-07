import { useEffect, useRef, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { TeamMemberCard } from "./TeamMemberCard";
import { TeamMemberDialog } from "./TeamMemberDialog";
import type { TeamMember } from "../data";
import { PODIUM_ORDER } from "../data";
import { fx } from "../effects/core/fx-layer";
import { stage } from "../effects/core/stage";
import { preloadEffectSkins } from "../effects/registry";

export function TeamPodium() {
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const isMobile = useIsMobile();
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    stage.root = stageRef.current;
    preloadEffectSkins();
    return () => {
      stage.root = null;
      stage.reset();
      fx.clear();
    };
  }, []);

  const topRow = PODIUM_ORDER.slice(0, 3);
  const bottomRow = PODIUM_ORDER.slice(3);

  const renderCard = (member: TeamMember, index: number) => (
    <TeamMemberCard
      key={member.uuid}
      member={member}
      index={index}
      total={PODIUM_ORDER.length}
      onClick={() => setSelectedMember(member)}
    />
  );

  return (
    <>
      <div ref={stageRef}>
        {isMobile ? (
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-end justify-center gap-2">
              {topRow.map((member, i) => renderCard(member, i))}
            </div>
            <div className="flex items-end justify-center gap-2">
              {bottomRow.map((member, i) => renderCard(member, i + 3))}
            </div>
          </div>
        ) : (
          <div className="flex items-end justify-center gap-6">
            {PODIUM_ORDER.map((member, index) => renderCard(member, index))}
          </div>
        )}
      </div>

      <TeamMemberDialog
        member={selectedMember}
        open={selectedMember !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedMember(null);
        }}
      />
    </>
  );
}
