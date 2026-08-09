import { Loader2, Package, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { useToastActions } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PlayerLabel } from "@/components/player-label";
import { ProjectThumb } from "@/features/workshop/components/ProjectThumb";
import {
  CardEmpty,
  CardError,
  CardLoading,
} from "@/features/admin/components/CardState";

export type PackMod =
  RouterOutput["admin"]["workshops"]["listPackMods"][number];

const ORIGIN_LABELS: Record<PackMod["origin"], string> = {
  suggestion: "Suggestion",
  dependency: "Dependency",
  import: "Pack Import",
};

const PUBLISH_STATES = {
  live: {
    label: "Live",
    className: "border-green-500/20 bg-green-500/10 text-green-400",
  },
  dropped: {
    label: "Missing from pack",
    className: "border-amber-500/20 bg-amber-500/10 text-amber-400",
  },
  awaiting: {
    label: "Awaiting publish",
    className: "border-zinc-500/20 bg-zinc-500/10 text-zinc-400",
  },
};

function publishState(row: PackMod) {
  if (row.liveAt) {
    return {
      ...PUBLISH_STATES.live,
      label: row.liveInVersion
        ? `${PUBLISH_STATES.live.label} · ${row.liveInVersion}`
        : PUBLISH_STATES.live.label,
    };
  }
  return row.droppedFromManifestAt
    ? PUBLISH_STATES.dropped
    : PUBLISH_STATES.awaiting;
}

function Credit({ row }: { row: PackMod }) {
  if (row.origin === "suggestion") {
    return row.suggestedByName ? (
      <span className="flex items-center gap-1">
        Suggested by <PlayerLabel name={row.suggestedByName} size={16} />
      </span>
    ) : (
      "Suggested by a player"
    );
  }
  if (row.origin === "dependency") {
    return row.requiredBy.length > 0
      ? `Required by ${row.requiredBy.map((required) => required.name).join(", ")}`
      : "Required dependency";
  }
  return row.liveInVersion
    ? `Added with ${row.liveInVersion}`
    : "From the published pack";
}

export function PackMembersCard({
  rows,
  workshopId,
  modpackId,
  isLoading,
  error,
  onRetry,
  onReconciled,
}: {
  rows: PackMod[];
  workshopId: number;
  modpackId: number;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onReconciled: () => void;
}) {
  const toast = useToastActions();

  const reconcileMutation = trpc.admin.modpacks.reconcile.useMutation({
    onSuccess: () => {
      toast.success("Checked against the published pack");
      onReconciled();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Card className="gap-0">
      <CardHeader className="gap-0 border-b">
        <CardTitle>Published Pack ({rows.length.toLocaleString()})</CardTitle>
        <CardDescription>
          What the published CurseForge pack actually contains, read from its
          manifest. Mods staged for the next update appear here once you publish
          a build that includes them.
        </CardDescription>
        <CardAction>
          <Button
            variant="outline"
            size="sm"
            disabled={reconcileMutation.isPending}
            onClick={() => reconcileMutation.mutate({ modpackId })}
          >
            {reconcileMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Check Published Pack
          </Button>
        </CardAction>
      </CardHeader>

      {isLoading ? (
        <CardLoading text="Loading pack members..." />
      ) : error ? (
        <CardError message={error} onRetry={onRetry} />
      ) : rows.length === 0 ? (
        <CardEmpty icon={Package} message="Nothing published yet" />
      ) : (
        <CardContent className="px-0">
          <Table>
            <TableHeader className="bg-sidebar-accent/50">
              <TableRow>
                <TableHead className="px-4">Mod</TableHead>
                <TableHead className="px-4">Origin</TableHead>
                <TableHead className="px-4">Credit</TableHead>
                <TableHead className="px-4">Publish State</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const state = publishState(row);
                const otherWorkshop =
                  row.suggestionWorkshopId !== null &&
                  row.suggestionWorkshopId !== workshopId
                    ? (row.suggestionWorkshopName ?? "another workshop")
                    : null;
                return (
                  <TableRow key={row.id}>
                    <TableCell className="px-4">
                      <div className="flex items-center gap-2">
                        <ProjectThumb
                          name={row.project.name}
                          thumbnailUrl={row.project.thumbnailUrl}
                          className="size-8 rounded text-[11px]"
                        />
                        <div>
                          <p className="font-medium">{row.project.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {row.project.slug}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 text-sm">
                      <p>{ORIGIN_LABELS[row.origin]}</p>
                      {otherWorkshop && (
                        <p className="text-xs text-muted-foreground">
                          from {otherWorkshop}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="px-4 text-sm text-muted-foreground">
                      <Credit row={row} />
                    </TableCell>
                    <TableCell className="px-4">
                      <Badge
                        variant="outline"
                        className={cn("text-xs", state.className)}
                      >
                        {state.label}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      )}
    </Card>
  );
}
