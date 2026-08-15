import { useState } from "react";
import { Package, Pencil, Plus, Trash2 } from "lucide-react";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { useToastActions } from "@/hooks/use-toast";
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
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CellDate, CellText } from "@/components/cell-text";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { Loading } from "@/components/loading-spinner";
import { useStickyValue } from "@/hooks/use-sticky-value";
import { CreateModpackDialog } from "./CreateModpackDialog";
import { ModpackSettingsDialog } from "./ModpackSettingsDialog";

type AdminModpackRow = RouterOutput["admin"]["modpacks"]["list"][number];

const columns: DataTableColumn<AdminModpackRow>[] = [
  {
    key: "name",
    header: "Name",
    minWidth: 200,
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
    render: (modpack) =>
      modpack.curseforgeProjectId ? (
        <>
          <Badge
            variant="outline"
            className="border-green-500/20 bg-green-500/10 text-green-400"
          >
            Published
          </Badge>
          <CellText
            value={`#${modpack.curseforgeProjectId}`}
            className="text-xs text-muted-foreground"
          />
        </>
      ) : (
        <Badge
          variant="outline"
          className="border-zinc-500/20 bg-zinc-500/10 text-zinc-400"
        >
          Unpublished
        </Badge>
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

export function ModpacksCard() {
  const toast = useToastActions();
  const utils = trpc.useUtils();

  const modpacksQuery = trpc.admin.modpacks.list.useQuery();

  const [createOpen, setCreateOpen] = useState(false);
  const [createKey, setCreateKey] = useState(0);
  const [settingsTarget, setSettingsTarget] = useState<AdminModpackRow | null>(
    null,
  );
  const [settingsKey, setSettingsKey] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<AdminModpackRow | null>(
    null,
  );
  const displayDeleteTarget = useStickyValue(deleteTarget);

  const deleteMutation = trpc.admin.modpacks.delete.useMutation({
    onSuccess: () => {
      toast.success("Modpack deleted");
      utils.admin.modpacks.list.invalidate();
      setDeleteTarget(null);
    },
    onError: (err) => toast.error(err.message),
  });

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

        {modpacksQuery.isLoading ? (
          <CardContent className="flex flex-1 items-center justify-center py-12">
            <Loading size="medium" text="Loading modpacks..." />
          </CardContent>
        ) : modpacksQuery.error ? (
          <CardContent className="flex flex-1 items-center justify-center py-12">
            <div className="text-center">
              <p className="text-destructive">{modpacksQuery.error.message}</p>
              <Button
                onClick={() => modpacksQuery.refetch()}
                className="mt-4"
                variant="outline"
              >
                Try Again
              </Button>
            </div>
          </CardContent>
        ) : modpacks.length === 0 ? (
          <CardContent className="flex flex-1 items-center justify-center py-12">
            <div className="text-center">
              <Package className="mx-auto size-12 text-muted-foreground" />
              <p className="mt-2 text-muted-foreground">No modpacks yet</p>
            </div>
          </CardContent>
        ) : (
          <CardContent className="px-0">
            <DataTable
              columns={columns}
              rows={modpacks}
              rowKey={(modpack) => modpack.id}
              actions={(modpack) => [
                {
                  label: "Edit",
                  icon: Pencil,
                  onClick: () => openSettings(modpack),
                },
                {
                  label:
                    modpack.workshops.length > 0
                      ? "In use by a workshop"
                      : "Delete",
                  icon: Trash2,
                  variant: "destructive",
                  disabled: modpack.workshops.length > 0,
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

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete &quot;{displayDeleteTarget?.name}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the modpack, its member list, and its
              recorded release history. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (deleteTarget) {
                  deleteMutation.mutate({ modpackId: deleteTarget.id });
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
