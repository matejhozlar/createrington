import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { TeamMemberCard } from "./TeamMemberCard";
import { TeamMemberDialog } from "./TeamMemberDialog";
import type { TeamMember } from "../data";
import { PODIUM_ORDER } from "../data";

export function TeamPodium() {
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const isMobile = useIsMobile();

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
