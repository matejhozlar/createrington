import { MinecraftAvatar } from "@/components/minecraft-avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { personName } from "../format";
import type { PlanningPerson } from "../types";

export function PersonAvatar({
  person,
  size = 20,
  className,
}: {
  person: PlanningPerson;
  size?: number;
  className?: string;
}) {
  return (
    <MinecraftAvatar
      username={personName(person)}
      uuid={person.minecraftUuid ?? undefined}
      size={size}
      className={className}
    />
  );
}

export function PersonChip({
  person,
  className,
}: {
  person: PlanningPerson;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5", className)}>
      <PersonAvatar person={person} />
      <span className="truncate text-sm font-medium">{personName(person)}</span>
    </span>
  );
}

export function AvatarStack({ people }: { people: PlanningPerson[] }) {
  if (people.length === 0) return null;

  return (
    <div className="flex -space-x-1.5">
      {people.map((person) => (
        <Tooltip key={person.discordId}>
          <TooltipTrigger asChild>
            <span className="rounded-sm ring-2 ring-card">
              <PersonAvatar person={person} />
            </span>
          </TooltipTrigger>
          <TooltipContent>{personName(person)}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
