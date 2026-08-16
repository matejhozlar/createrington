import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  ModEnvironment,
  ModEnvironmentSource,
} from "@createrington/shared/db";
import { MOD_ENVIRONMENTS } from "@createrington/shared/workshop";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  environmentTitle,
  MOD_ENVIRONMENT_STYLES,
} from "@/features/workshop/format";

/** Values shown ahead of the server, keyed by CurseForge project id */
export type EnvironmentDisplay = Map<number, ModEnvironment>;

export function EnvironmentCell({
  projectId,
  environment,
  source,
  display,
  onSetEnvironment,
}: {
  projectId: number;
  environment: ModEnvironment;
  source: ModEnvironmentSource | null;
  display: EnvironmentDisplay;
  onSetEnvironment: (projectId: number, environment: ModEnvironment) => void;
}) {
  const pending = display.get(projectId);
  const shown = pending ?? environment;
  const shownSource = pending
    ? pending === "unspecified"
      ? null
      : "manual"
    : source;
  const style = MOD_ENVIRONMENT_STYLES[shown];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          className="cursor-pointer"
          title={environmentTitle(shown, shownSource)}
        >
          <Badge
            variant="outline"
            className={cn("pointer-events-none text-xs", style.className)}
          >
            {style.label}
          </Badge>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        onClick={(event) => event.stopPropagation()}
      >
        {MOD_ENVIRONMENTS.map((value) => (
          <DropdownMenuItem
            key={value}
            disabled={value === shown}
            onClick={() => onSetEnvironment(projectId, value)}
          >
            <Check
              className={cn(
                "size-4",
                value === shown ? "opacity-100" : "opacity-0",
              )}
            />
            {MOD_ENVIRONMENT_STYLES[value].label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
