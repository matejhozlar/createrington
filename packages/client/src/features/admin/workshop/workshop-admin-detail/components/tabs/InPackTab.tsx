import { useRef, useState } from "react";
import { FileUp, RefreshCw } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { formatDate } from "@createrington/shared/format";
import type { ModEnvironment } from "@createrington/shared/db";
import { trpc, queryClient } from "@/lib/trpc";
import { useMutationToast } from "@/hooks/use-mutation-toast";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FilterBar } from "@/features/admin/components/FilterBar";
import type { EnvironmentDisplay } from "@/features/workshop/components/EnvironmentCell";
import type { PackMod } from "@/features/admin/workshop/workshop-admin-detail/types";
import { useManifestImport } from "@/features/admin/workshop/workshop-admin-detail/hooks/use-manifest-import";
import { CurrentPackTable } from "@/features/admin/workshop/workshop-admin-detail/components/in-pack/CurrentPackTable";
import { ReleaseModsTable } from "@/features/admin/workshop/workshop-admin-detail/components/in-pack/ReleaseModsTable";

const CURRENT_PACK = "current";

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
  const [releaseId, setReleaseId] = useState<number | null>(null);
  const manifestInputRef = useRef<HTMLInputElement>(null);

  const modpacksQuery = useQuery(trpc.admin.modpacks.list.queryOptions());
  const modpack = modpacksQuery.data?.find((row) => row.id === modpackId);
  const unlinked =
    modpack !== undefined && modpack.curseforgeProjectId === null;

  const releasesQuery = useQuery(
    trpc.admin.modpacks.listReleases.queryOptions({ modpackId }),
  );

  const reconcileMutation = useMutation(
    trpc.admin.modpacks.reconcile.mutationOptions(
      useMutationToast({
        success: "Checked against the published pack",
        onSuccess: () => {
          onReconciled();
          void queryClient.invalidateQueries(
            trpc.admin.modpacks.listReleases.queryFilter({ modpackId }),
          );
        },
      }),
    ),
  );

  const manifest = useManifestImport({
    modpackId,
    memberCount: rows.length,
    onImported: onReconciled,
  });

  const query = search.trim().toLowerCase();
  const title = unlinked ? "Pack Members" : "Published Pack";

  const action = (
    <>
      {unlinked ? (
        <Button
          variant="outline"
          size="sm"
          loading={manifest.importing}
          onClick={() => manifestInputRef.current?.click()}
          className="max-sm:w-full"
        >
          <FileUp className="size-4" />
          Import manifest.json
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          disabled={modpacksQuery.isLoading}
          loading={reconcileMutation.isPending}
          onClick={() => reconcileMutation.mutate({ modpackId })}
          className="max-sm:w-full"
        >
          <RefreshCw className="size-4" />
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
          if (file) void manifest.importFile(file);
        }}
      />
    </>
  );

  return (
    <>
      <FilterBar
        search={search}
        onSearchChange={onSearchChange}
        placeholder="Search mods..."
        activeCount={(query ? 1 : 0) + (releaseId === null ? 0 : 1)}
      >
        <Select
          value={releaseId === null ? CURRENT_PACK : String(releaseId)}
          onValueChange={(value) =>
            setReleaseId(value === CURRENT_PACK ? null : Number(value))
          }
        >
          <SelectTrigger className="min-w-[190px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={CURRENT_PACK}>Current</SelectItem>
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

      {releaseId === null ? (
        <CurrentPackTable
          workshopId={workshopId}
          rows={rows}
          query={query}
          isLoading={isLoading}
          error={error}
          onRetry={onRetry}
          envDisplay={envDisplay}
          onSetEnvironment={onSetEnvironment}
          unlinked={unlinked}
          title={title}
          action={action}
        />
      ) : (
        <ReleaseModsTable
          releaseId={releaseId}
          query={query}
          title={title}
          action={action}
        />
      )}

      <ConfirmDialog
        open={manifest.pendingManifest !== null}
        onOpenChange={(open) => {
          if (!open) manifest.cancelPending();
        }}
        title="Replace the pack contents?"
        description={
          <>
            This pack already has {rows.length.toLocaleString()} members.
            Importing{" "}
            {manifest.pendingManifest?.version
              ? `manifest "${manifest.pendingManifest.version}"`
              : "this manifest"}{" "}
            syncs them against its{" "}
            {(manifest.pendingManifest?.files.length ?? 0).toLocaleString()}{" "}
            mods: members missing from the manifest are dropped, and their
            suggestions move back to Coming next update.
          </>
        }
        confirmLabel="Import"
        onConfirm={manifest.confirmPending}
      />
    </>
  );
}
