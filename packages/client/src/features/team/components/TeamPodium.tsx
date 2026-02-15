import { useState } from "react";
import { TeamMemberCard } from "./TeamMemberCard";
import { TeamMemberDialog } from "./TeamMemberDialog";
import type { TeamMember } from "../data";
import { PODIUM_ORDER } from "../data";

export const TeamPodium = () => {
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);

  return (
    <>
      <div className="flex items-end justify-center gap-2 md:gap-6">
        {PODIUM_ORDER.map((member, index) => (
          <TeamMemberCard
            key={member.uuid}
            member={member}
            index={index}
            total={PODIUM_ORDER.length}
            onClick={() => setSelectedMember(member)}
          />
        ))}
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
};
