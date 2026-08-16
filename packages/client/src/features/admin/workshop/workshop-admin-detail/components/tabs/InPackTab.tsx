import { useMemo, useRef, useState } from "react";
import { FileUp, Loader2, Package, RefreshCw, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { useToastActions } from "@/hooks/use-toast";
import {
  modpackManifestUploadSchema,
  type ModpackManifestUpload,
} from "@createrington/shared/workshop";
import { Paginator } from "@/components/paginator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { CellDate, CellText } from "@/components/cell-text";
import {
  BadgeCellSkeleton,
  DataTable,
  type DataTableColumn,
} from "@/components/data-table";
import { PlayerLabel } from "@/components/player-label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FilterBar } from "@/features/admin/components/FilterBar";
import { CardEmpty, CardError } from "@/features/admin/components/CardState";
import { formatDate } from "@/features/workshop/format";
import type { ModEnvironment } from "@createrington/shared/db";
import {
  EnvironmentCell,
  type EnvironmentDisplay,
} from "@/features/workshop/components/EnvironmentCell";
import type { PackMod, ReleaseMod } from "../../types";
import { ModCell, ModCellSkeleton } from "../ModCell";

const MODS_PER_PAGE = 10;

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
    label: "Dropped",
    className: "border-amber-500/20 bg-amber-500/10 text-amber-400",
  },
  awaiting: {
    label: "Awaiting",
    className: "border-zinc-500/20 bg-zinc-500/10 text-zinc-400",
  },
};

function publishState(row: PackMod) {
  if (row.liveAt) {
    return {
      ...PUBLISH_STATES.live,
      label: row.liveInVersion ?? PUBLISH_STATES.live.label,
      title: row.liveInVersion ? `Live in ${row.liveInVersion}` : undefined,
    };
  }
  const state = row.droppedFromManifestAt
    ? PUBLISH_STATES.dropped
    : PUBLISH_STATES.awaiting;
  return { ...state, title: undefined };
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
    return row.requiredBy.length > 0 ? (
      <CellText
        value={`Required by ${row.requiredBy.map((required) => required.name).join(", ")}`}
      />
    ) : (
      "Required dependency"
    );
  }
  return row.liveInVersion
    ? `Added with ${row.liveInVersion}`
    : "From the pack manifest";
}

function releaseFileLabel(row: ReleaseMod) {
  return row.fileName ?? row.displayName ?? `File #${row.fileId}`;
}

const MAX_MANIFEST_BYTES = 5 * 1024 * 1024;

export function InPackTab({
  workshopId,
  modpackId,
  rows,
  isLoading,
  error,
  onRetry,
  search,
  onSearchChange,
  onReconciled,
  envDisplay,
  onSetEnvironment,
}: {
  workshopId: number;
  modpackId: number;
  rows: PackMod[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  search: string;
  onSearchChange: (value: string) => void;
  onReconciled: () => void;
  envDisplay: EnvironmentDisplay;
  onSetEnvironment: (projectId: number, environment: ModEnvironment) => void;
}) {
  const toast = useToastActions();
  const utils = trpc.useUtils();
  const [selected, setSelected] = useState("current");
  const [requestedPage, setRequestedPage] = useState(0);
  const manifestInputRef = useRef<HTMLInputElement>(null);
  const [pendingManifest, setPendingManifest] =
    useState<ModpackManifestUpload | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const isCurrent = selected === "current";
  const releaseId = isCurrent ? null : Number(selected);

  const modpacksQuery = trpc.admin.modpacks.list.useQuery();
  const modpack = modpacksQuery.data?.find((row) => row.id === modpackId);
  const unlinked =
    modpack !== undefined && modpack.curseforgeProjectId === null;

  const releasesQuery = trpc.admin.modpacks.listReleases.useQuery({
    modpackId,
  });
  const releaseModsQuery = trpc.admin.modpacks.listReleaseMods.useQuery(
    { releaseId: releaseId ?? 0 },
    { enabled: releaseId !== null },
  );

  const reconcileMutation = trpc.admin.modpacks.reconcile.useMutation({
    onSuccess: () => {
      toast.success("Checked against the published pack");
      onReconciled();
      utils.admin.modpacks.listReleases.invalidate({ modpackId });
    },
    onError: (err) => toast.error(err.message),
  });

  const seedMutation = trpc.admin.modpacks.seedFromManifest.useMutation({
    onSuccess: (result) => {
      if (result.unresolvedProjectIds.length > 0) {
        toast.warning(
          `Imported ${result.memberCount} mods, ${result.unresolvedProjectIds.length} could not be resolved on CurseForge`,
        );
      } else if (result.duplicateProjectIds.length > 0) {
        toast.warning(
          `Imported ${result.memberCount} mods, ${result.duplicateProjectIds.length} listed more than once in the manifest and were merged`,
        );
      } else {
        toast.success(`Imported ${result.memberCount} mods from the manifest`);
      }
      onReconciled();
      utils.admin.modpacks.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleManifestFile = async (file: File) => {
    if (file.size > MAX_MANIFEST_BYTES) {
      toast.error("That file is too large to be a modpack manifest.json");
      return;
    }
    let raw: unknown;
    try {
      raw = JSON.parse(await file.text());
    } catch {
      toast.error("Could not read that file as JSON");
      return;
    }
    const parsed = modpackManifestUploadSchema.safeParse(raw);
    if (!parsed.success) {
      toast.error("That file does not look like a modpack manifest.json");
      return;
    }
    if (rows.length === 0) {
      seedMutation.mutate({ modpackId, manifest: parsed.data });
      return;
    }
    setPendingManifest(parsed.data);
    setConfirmOpen(true);
  };

  const query = search.trim().toLowerCase();

  const currentFiltered = useMemo(() => {
    if (!query) return rows;
    return rows.filter((row) =>
      [row.project.name, row.project.slug, row.suggestedByName].some((value) =>
        value?.toLowerCase().includes(query),
      ),
    );
  }, [rows, query]);

  const releaseRows = useMemo(
    () => releaseModsQuery.data ?? [],
    [releaseModsQuery.data],
  );
  const releaseFiltered = useMemo(() => {
    if (!query) return releaseRows;
    return releaseRows.filter((row) =>
      [row.projectName, row.projectSlug, row.fileName].some((value) =>
        value?.toLowerCase().includes(query),
      ),
    );
  }, [releaseRows, query]);

  const filtered = isCurrent ? currentFiltered.length : releaseFiltered.length;
  const total = isCurrent ? rows.length : releaseRows.length;
  const totalPages = Math.ceil(filtered / MODS_PER_PAGE);
  const page = Math.min(requestedPage, Math.max(0, totalPages - 1));

  const currentColumns: DataTableColumn<PackMod>[] = [
    {
      key: "mod",
      header: "Mod",
      minWidth: 220,
      skeleton: () => <ModCellSkeleton />,
      render: (row) => (
        <ModCell
          name={row.project.name}
          slug={row.project.slug}
          thumbnailUrl={row.project.thumbnailUrl}
        />
      ),
    },
    {
      key: "origin",
      header: "Origin",
      width: 140,
      cellClassName: "text-sm",
      render: (row) => {
        const otherWorkshop =
          row.suggestionWorkshopId !== null &&
          row.suggestionWorkshopId !== workshopId
            ? (row.suggestionWorkshopName ?? "another workshop")
            : null;
        return (
          <>
            <p>{ORIGIN_LABELS[row.origin]}</p>
            {otherWorkshop && (
              <CellText
                value={`from ${otherWorkshop}`}
                className="text-xs text-muted-foreground"
              />
            )}
          </>
        );
      },
    },
    {
      key: "credit",
      header: "Credit",
      minWidth: 180,
      cellClassName: "text-sm text-muted-foreground",
      render: (row) => <Credit row={row} />,
    },
    {
      key: "environment",
      header: "Environment",
      width: 140,
      skeleton: () => <BadgeCellSkeleton />,
      render: (row) => (
        <EnvironmentCell
          projectId={row.project.id}
          environment={row.project.environment}
          source={row.project.environmentSource}
          display={envDisplay}
          onSetEnvironment={onSetEnvironment}
        />
      ),
    },
    {
      key: "publishState",
      header: "Publish State",
      width: 150,
      skeleton: () => <BadgeCellSkeleton />,
      render: (row) => {
        const state = publishState(row);
        return (
          <Badge
            variant="outline"
            className={cn("text-xs", state.className)}
            title={state.title}
          >
            {state.label}
          </Badge>
        );
      },
    },
  ];

  const releaseColumns: DataTableColumn<ReleaseMod>[] = [
    {
      key: "mod",
      header: "Mod",
      minWidth: 220,
      skeleton: () => <ModCellSkeleton />,
      render: (row) => (
        <ModCell
          name={row.projectName}
          slug={row.projectSlug}
          thumbnailUrl={row.thumbnailUrl}
        />
      ),
    },
    {
      key: "file",
      header: "File",
      minWidth: 180,
      render: (row) => (
        <CellText
          value={releaseFileLabel(row)}
          className="text-sm text-muted-foreground"
        />
      ),
    },
    {
      key: "fileDate",
      header: "File Date",
      width: 130,
      render: (row) => <CellDate value={row.fileDate} />,
    },
  ];

  const handleSearchChange = (value: string) => {
    onSearchChange(value);
    setRequestedPage(0);
  };

  return (
    <>
      <FilterBar
        search={search}
        onSearchChange={handleSearchChange}
        placeholder="Search mods..."
        activeCount={(query ? 1 : 0) + (isCurrent ? 0 : 1)}
      >
        <Select
          value={selected}
          onValueChange={(value) => {
            setSelected(value);
            setRequestedPage(0);
          }}
        >
          <SelectTrigger className="min-w-[190px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="current">Current</SelectItem>
            {(releasesQuery.data ?? []).map((release) => (
              <SelectItem key={release.id} value={String(release.id)}>
                {release.version ??
                  release.displayName ??
                  `File #${release.curseforgeFileId}`}
                <span className="text-muted-foreground">
                  · {formatDate(release.publishedAt ?? release.createdAt)}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterBar>

      <Card className="gap-0">
        <CardHeader className="border-b">
          <CardTitle>
            {unlinked ? "Pack Members" : "Published Pack"} (
            {total.toLocaleString()})
          </CardTitle>
          <CardDescription className="max-sm:col-start-1">
            {!isCurrent
              ? "What this build shipped, frozen at the moment it was recorded."
              : unlinked
                ? "What the pack contains, seeded from an imported manifest.json. Once the pack is published on CurseForge, link its project to derive this automatically."
                : "What the published CurseForge pack actually contains, read from its manifest. Mods staged for the next update appear here once you publish a build that includes them."}
          </CardDescription>
          <CardAction className="max-sm:col-span-full max-sm:row-start-3 max-sm:mt-2 max-sm:justify-self-stretch">
            {unlinked ? (
              <Button
                variant="outline"
                size="sm"
                disabled={seedMutation.isPending}
                onClick={() => manifestInputRef.current?.click()}
                className="max-sm:w-full"
              >
                {seedMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <FileUp className="size-4" />
                )}
                Import manifest.json
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                disabled={
                  reconcileMutation.isPending || modpacksQuery.isLoading
                }
                onClick={() => reconcileMutation.mutate({ modpackId })}
                className="max-sm:w-full"
              >
                {reconcileMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                Check Published Pack
              </Button>
            )}
            <input
              ref={manifestInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void handleManifestFile(file);
              }}
            />
          </CardAction>
        </CardHeader>

        {isCurrent ? (
          error ? (
            <CardError message={error} onRetry={onRetry} />
          ) : !isLoading && rows.length === 0 ? (
            <CardEmpty
              icon={Package}
              message={
                unlinked ? "Nothing imported yet" : "Nothing published yet"
              }
            />
          ) : !isLoading && currentFiltered.length === 0 ? (
            <CardEmpty icon={Search} message="No mods match your search" />
          ) : (
            <CardContent className="px-0">
              <DataTable
                columns={currentColumns}
                rows={currentFiltered.slice(
                  page * MODS_PER_PAGE,
                  (page + 1) * MODS_PER_PAGE,
                )}
                loading={isLoading}
                loadingRows={MODS_PER_PAGE}
                rowKey={(row) => row.id}
              />
              <Paginator
                page={page}
                limit={MODS_PER_PAGE}
                total={currentFiltered.length}
                totalPages={totalPages}
                onPageChange={setRequestedPage}
                itemLabel="mod"
                className="px-4 pt-4"
              />
            </CardContent>
          )
        ) : releaseModsQuery.error ? (
          <CardError
            message={releaseModsQuery.error.message}
            onRetry={() => releaseModsQuery.refetch()}
          />
        ) : !releaseModsQuery.isLoading && releaseRows.length === 0 ? (
          <CardEmpty icon={Package} message="This release recorded no mods" />
        ) : !releaseModsQuery.isLoading && releaseFiltered.length === 0 ? (
          <CardEmpty icon={Search} message="No mods match your search" />
        ) : (
          <CardContent className="px-0">
            <DataTable
              columns={releaseColumns}
              rows={releaseFiltered.slice(
                page * MODS_PER_PAGE,
                (page + 1) * MODS_PER_PAGE,
              )}
              loading={releaseModsQuery.isLoading}
              loadingRows={MODS_PER_PAGE}
              rowKey={(row) => `${row.curseforgeProjectId}-${row.fileId}`}
            />
            <Paginator
              page={page}
              limit={MODS_PER_PAGE}
              total={releaseFiltered.length}
              totalPages={totalPages}
              onPageChange={setRequestedPage}
              itemLabel="mod"
              className="px-4 pt-4"
            />
          </CardContent>
        )}
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace the pack contents?</AlertDialogTitle>
            <AlertDialogDescription>
              This pack already has {rows.length.toLocaleString()} members.
              Importing{" "}
              {pendingManifest?.version
                ? `manifest "${pendingManifest.version}"`
                : "this manifest"}{" "}
              syncs them against its{" "}
              {(pendingManifest?.files.length ?? 0).toLocaleString()} mods:
              members missing from the manifest are dropped, and their
              suggestions move back to Coming next update.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingManifest) {
                  seedMutation.mutate({ modpackId, manifest: pendingManifest });
                }
              }}
            >
              Import
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
