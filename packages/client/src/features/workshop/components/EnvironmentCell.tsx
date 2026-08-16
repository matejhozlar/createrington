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

export interface EnvironmentOverride {
  projectId: number;
  environment: ModEnvironment;
}

export function EnvironmentCell({
  projectId,
  environment,
  source,
  override,
  onSetEnvironment,
}: {
  projectId: number;
  environment: ModEnvironment;
  source: ModEnvironmentSource | null;
  override: EnvironmentOverride | null;
  onSetEnvironment: (projectId: number, environment: ModEnvironment) => void;
}) {
  const display =
    override?.projectId === projectId ? override.environment : environment;
  const style = MOD_ENVIRONMENT_STYLES[display];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          className="cursor-pointer"
          title={environmentTitle(display, source)}
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
            disabled={value === display}
            onClick={() => onSetEnvironment(projectId, value)}
          >
            <Check
              className={cn(
                "size-4",
                value === display ? "opacity-100" : "opacity-0",
              )}
            />
            {MOD_ENVIRONMENT_STYLES[value].label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
