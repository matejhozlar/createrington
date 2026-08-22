import { useState } from "react";
import { ArrowRight, History, Minus, Plus, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ProjectThumb } from "@/features/workshop/components/ProjectThumb";
import {
  CardEmpty,
  CardError,
  CardLoading,
} from "@/features/admin/components/CardState";
import {
  DISABLED_BADGE_CLASS,
  DISABLED_LABEL,
  formatDate,
  PROJECT_KIND_BADGE_CLASS,
  projectKindLabel,
} from "@/features/workshop/format";

type Release = RouterOutput["admin"]["modpacks"]["listReleases"][number];
type Diff = RouterOutput["admin"]["modpacks"]["getReleaseDiff"];
type DiffEntry = Diff["added"][number];

const CHANGE_GROUPS = [
  {
    key: "added" as const,
    label: "Added",
    icon: Plus,
    className: "border-green-500/20 bg-green-500/10 text-green-400",
  },
  {
    key: "updated" as const,
    label: "Updated",
    icon: RefreshCw,
    className: "border-sky-500/20 bg-sky-500/10 text-sky-400",
  },
  {
    key: "removed" as const,
    label: "Removed",
    icon: Minus,
    className: "border-red-500/20 bg-red-500/10 text-red-400",
  },
];

function fileLabel(entry: { fileName: string | null; fileId: number }) {
  return entry.fileName ?? `File #${entry.fileId}`;
}

function changeLabel(
  side: { fileName: string | null; fileId: number; required: boolean },
  flagOnly: boolean,
) {
  if (!flagOnly) return fileLabel(side);
  return side.required ? "Enabled" : DISABLED_LABEL;
}

function ChangeRow({
  entry,
  showBump,
}: {
  entry: DiffEntry;
  showBump: boolean;
}) {
  const kind = projectKindLabel(entry.classId);
  const bump = showBump ? entry.previousFile : null;
  const flagOnly =
    bump !== null &&
    bump.fileId === entry.fileId &&
    bump.required !== entry.required;
  return (
    <div className="flex items-center gap-2.5 px-4 py-2 text-sm">
      <ProjectThumb
        name={entry.projectName}
        thumbnailUrl={entry.thumbnailUrl}
        className="size-7 rounded text-[10px]"
      />
      <span className="flex min-w-0 flex-1 items-center gap-1.5">
        <span className="min-w-0 truncate font-medium">
          {entry.projectName}
        </span>
        {kind && (
          <Badge variant="outline" className={PROJECT_KIND_BADGE_CLASS}>
            {kind}
          </Badge>
        )}
        {!entry.required && (
          <Badge variant="outline" className={DISABLED_BADGE_CLASS}>
            {DISABLED_LABEL}
          </Badge>
        )}
      </span>
      {bump ? (
        <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <span className="truncate line-through">
            {changeLabel(bump, flagOnly)}
          </span>
          <ArrowRight className="size-3 shrink-0" />
          <span className="truncate text-foreground">
            {changeLabel(entry, flagOnly)}
          </span>
        </span>
      ) : (
        <span className="truncate text-xs text-muted-foreground">
          {fileLabel(entry)}
        </span>
      )}
    </div>
  );
}

function ReleaseDiff({ releaseId }: { releaseId: number }) {
  const diffQuery = trpc.admin.modpacks.getReleaseDiff.useQuery({ releaseId });

  if (diffQuery.isLoading) {
    return (
      <p className="px-4 py-3 text-sm text-muted-foreground">
        Loading changes...
      </p>
    );
  }
  if (diffQuery.error) {
    return (
      <p className="px-4 py-3 text-sm text-destructive">
        {diffQuery.error.message}
      </p>
    );
  }

  const diff = diffQuery.data;
  if (!diff) return null;

  if (!diff.previous) {
    return (
      <p className="px-4 py-3 text-sm text-muted-foreground">
        First recorded release, so there is nothing to compare it against.
        Changes show up from the next published build onward.
      </p>
    );
  }

  const groups = CHANGE_GROUPS.filter((group) => diff[group.key].length > 0);
  if (groups.length === 0) {
    return (
      <p className="px-4 py-3 text-sm text-muted-foreground">
        Nothing changed against {diff.previous.version ?? "the previous build"}.
      </p>
    );
  }

  return (
    <div className="divide-y divide-border">
      {groups.map((group) => (
        <div key={group.key} className="py-2">
          <div className="flex items-center gap-2 px-4 py-1.5">
            <Badge
              variant="outline"
              className={cn("gap-1 text-xs", group.className)}
            >
              <group.icon className="size-3" />
              {group.label} {diff[group.key].length}
            </Badge>
          </div>
          {diff[group.key].map((entry) => (
            <ChangeRow
              key={`${group.key}-${entry.curseforgeProjectId}-${entry.fileId}`}
              entry={entry}
              showBump={group.key === "updated"}
            />
          ))}
        </div>
      ))}
      <p className="px-4 py-2 text-xs text-muted-foreground">
        {diff.unchanged} unchanged
      </p>
    </div>
  );
}

export function ReleasesTab({ modpackId }: { modpackId: number }) {
  const releasesQuery = trpc.admin.modpacks.listReleases.useQuery({
    modpackId,
  });
  const [openId, setOpenId] = useState<number | null>(null);

  const releases = releasesQuery.data ?? [];

  return (
    <Card className="gap-0">
      <CardHeader className="border-b">
        <CardTitle>Release History ({releases.length})</CardTitle>
        <CardDescription>
          What each published build shipped, frozen at the moment it was read.
          Archiving a file on CurseForge does not affect anything recorded here.
        </CardDescription>
      </CardHeader>

      {releasesQuery.isLoading ? (
        <CardLoading text="Loading releases..." />
      ) : releasesQuery.error ? (
        <CardError
          message={releasesQuery.error.message}
          onRetry={() => releasesQuery.refetch()}
        />
      ) : releases.length === 0 ? (
        <CardEmpty icon={History} message="No published builds recorded yet" />
      ) : (
        <CardContent className="divide-y divide-border px-0">
          {releases.map((release: Release) => {
            const open = openId === release.id;
            return (
              <div key={release.id}>
                <button
                  type="button"
                  className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left hover:bg-accent/40"
                  onClick={() => setOpenId(open ? null : release.id)}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {release.version ?? release.displayName ?? "Unversioned"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {release.modCount} mods
                      {release.minecraftVersion
                        ? ` · ${release.minecraftVersion}`
                        : ""}
                      {release.modLoader ? ` · ${release.modLoader}` : ""}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(release.publishedAt ?? release.createdAt)}
                  </span>
                  <Badge
                    variant="outline"
                    className={cn("text-xs", open && "bg-accent")}
                  >
                    {open ? "Hide" : "Changes"}
                  </Badge>
                </button>
                {open && <ReleaseDiff releaseId={release.id} />}
              </div>
            );
          })}
        </CardContent>
      )}
    </Card>
  );
}
