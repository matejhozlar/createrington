import { Check, Loader2 } from "lucide-react";
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

export function EnvironmentCell({
  projectId,
  environment,
  source,
  busy,
  onSetEnvironment,
}: {
  projectId: number;
  environment: ModEnvironment;
  source: ModEnvironmentSource | null;
  busy: boolean;
  onSetEnvironment: (projectId: number, environment: ModEnvironment) => void;
}) {
  const style = MOD_ENVIRONMENT_STYLES[environment];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        asChild
        disabled={busy}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="cursor-pointer"
          title={environmentTitle(environment, source)}
        >
          <Badge
            variant="outline"
            className={cn("pointer-events-none text-xs", style.className)}
          >
            {busy && <Loader2 className="size-3 animate-spin" />}
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
            disabled={value === environment}
            onClick={() => onSetEnvironment(projectId, value)}
          >
            <Check
              className={cn(
                "size-4",
                value === environment ? "opacity-100" : "opacity-0",
              )}
            />
            {MOD_ENVIRONMENT_STYLES[value].label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
