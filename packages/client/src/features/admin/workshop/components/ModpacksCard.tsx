import { useState } from "react";
import { Package, Pencil, Plus, Trash2 } from "lucide-react";
import { trpc, type RouterOutput, queryClient } from "@/lib/trpc";
import { useMutationToast } from "@/hooks/use-mutation-toast";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/query-states";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CellDate, CellText } from "@/components/cell-text";
import {
  BadgeCellSkeleton,
  DataTable,
  TwoLineCellSkeleton,
  type DataTableColumn,
} from "@/components/data-table";
import { CreateModpackDialog } from "./CreateModpackDialog";
import { ModpackSettingsDialog } from "./ModpackSettingsDialog";
import { useQuery, useMutation } from "@tanstack/react-query";

type AdminModpackRow = RouterOutput["admin"]["modpacks"]["list"][number];

const columns: DataTableColumn<AdminModpackRow>[] = [
  {
    key: "name",
    header: "Name",
    minWidth: 200,
    skeleton: () => <TwoLineCellSkeleton />,
    render: (modpack) => (
      <>
        <CellText value={modpack.name} className="font-medium" />
        {modpack.description && (
          <CellText
            value={modpack.description}
            className="text-xs text-muted-foreground"
          />
        )}
      </>
    ),
  },
  {
    key: "published",
    header: "Published",
    width: 120,
    skeleton: () => <BadgeCellSkeleton />,
    render: (modpack) =>
      modpack.curseforgeProjectId ? (
        <>
          <Badge tone="success">Published</Badge>
          <CellText
            value={`#${modpack.curseforgeProjectId}`}
            className="text-xs text-muted-foreground"
          />
        </>
      ) : (
        <Badge tone="neutral">Unpublished</Badge>
      ),
  },
  {
    key: "workshops",
    header: "Workshops",
    minWidth: 160,
    render: (modpack) =>
      modpack.workshops.length === 0 ? (
        <span className="text-sm text-muted-foreground">None</span>
      ) : (
        <CellText
          value={modpack.workshops.map((workshop) => workshop.name).join(", ")}
          className="text-sm"
        />
      ),
  },
  {
    key: "mods",
    header: "Mods",
    width: 80,
    skeleton: () => <TwoLineCellSkeleton />,
    render: (modpack) => (
      <>
        <CellText value={String(modpack.modCount)} />
        <CellText
          value={`${modpack.liveCount.toLocaleString()} live`}
          className="text-xs text-muted-foreground"
        />
      </>
    ),
  },
  {
    key: "created",
    header: "Created",
    width: 120,
    render: (modpack) => <CellDate value={modpack.createdAt} />,
  },
];

function deleteLabel(modpack: AdminModpackRow): string {
  if (modpack.workshops.length > 0) return "In use by a workshop";
  if (modpack.launcherPackSlug !== null) {
    return `Offered by the launcher as "${modpack.launcherPackSlug}"`;
  }
  return "Delete";
}

export function ModpacksCard() {
  const modpacksQuery = useQuery(trpc.admin.modpacks.list.queryOptions());

  const [createOpen, setCreateOpen] = useState(false);
  const [createKey, setCreateKey] = useState(0);
  const [settingsTarget, setSettingsTarget] = useState<AdminModpackRow | null>(
    null,
  );
  const [settingsKey, setSettingsKey] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<AdminModpackRow | null>(
    null,
  );

  const deleteMutation = useMutation(
    trpc.admin.modpacks.delete.mutationOptions(
      useMutationToast({
        success: "Modpack deleted",
        onSuccess: () => {
          void queryClient.invalidateQueries(
            trpc.admin.modpacks.list.pathFilter(),
          );
          setDeleteTarget(null);
        },
      }),
    ),
  );

  const openCreate = () => {
    setCreateKey((key) => key + 1);
    setCreateOpen(true);
  };

  const openSettings = (modpack: AdminModpackRow) => {
    setSettingsKey((key) => key + 1);
    setSettingsTarget(modpack);
  };

  const modpacks = modpacksQuery.data ?? [];

  return (
    <>
      <Card className="gap-0">
        <CardHeader className="gap-0 border-b">
          <CardTitle>Modpacks ({modpacks.length.toLocaleString()})</CardTitle>
          <CardAction>
            <Button size="sm" variant="outline" onClick={openCreate}>
              <Plus className="mr-2 size-4" />
              New Modpack
            </Button>
          </CardAction>
        </CardHeader>

        {modpacksQuery.error ? (
          <ErrorState
            message={modpacksQuery.error.message}
            onRetry={() => modpacksQuery.refetch()}
          />
        ) : !modpacksQuery.isLoading && modpacks.length === 0 ? (
          <EmptyState icon={Package} message="No modpacks yet" />
        ) : (
          <CardContent className="px-0">
            <DataTable
              columns={columns}
              rows={modpacks}
              loading={modpacksQuery.isLoading}
              rowKey={(modpack) => modpack.id}
              actions={(modpack) => [
                {
                  label: "Edit",
                  icon: Pencil,
                  onClick: () => openSettings(modpack),
                },
                {
                  label: deleteLabel(modpack),
                  icon: Trash2,
                  variant: "destructive",
                  disabled:
                    modpack.workshops.length > 0 ||
                    modpack.launcherPackSlug !== null,
                  onClick: () => setDeleteTarget(modpack),
                },
              ]}
            />
          </CardContent>
        )}
      </Card>

      <CreateModpackDialog
        key={createKey}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />

      {settingsTarget && (
        <ModpackSettingsDialog
          key={`settings-${settingsKey}`}
          open
          onOpenChange={(open) => {
            if (!open) setSettingsTarget(null);
          }}
          modpack={settingsTarget}
        />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={<>Delete &quot;{deleteTarget?.name}&quot;?</>}
        description="This permanently removes the modpack, its member list, and its recorded release history. This cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() =>
          deleteTarget
            ? deleteMutation.mutateAsync({ modpackId: deleteTarget.id })
            : undefined
        }
      />
    </>
  );
}
