import { useState } from "react";
import { useNavigate } from "react-router";
import { Hammer, Pencil, Plus, Trash2 } from "lucide-react";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { useToastActions } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CellDate, CellText } from "@/components/cell-text";
import {
  BadgeCellSkeleton,
  DataTable,
  TwoLineCellSkeleton,
  type DataTableColumn,
} from "@/components/data-table";
import { LabeledSwitch } from "@/components/labeled-switch";
import { useStickyValue } from "@/hooks/use-sticky-value";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { AdminPageTitle } from "@/features/admin/components/AdminPageTitle";
import { WORKSHOP_STATUS_STYLES, loaderName } from "@/features/workshop/format";
import { CreateWorkshopDialog } from "./components/CreateWorkshopDialog";
import { ModpacksCard } from "./components/ModpacksCard";
import { WorkshopSettingsDialog } from "./workshop-admin-detail/components/WorkshopSettingsDialog";

type AdminWorkshopRow = RouterOutput["admin"]["workshops"]["list"][number];

export function AdminWorkshop() {
  const navigate = useNavigate();
  const toast = useToastActions();
  const utils = trpc.useUtils();

  const workshopsQuery = trpc.admin.workshops.list.useQuery();
  const flagsQuery = trpc.admin.features.list.useQuery();
  const workshopFlag = flagsQuery.data?.find((f) => f.name === "workshop");

  const setFlagMutation = trpc.admin.features.set.useMutation({
    onSuccess: (flag) => {
      toast.success(`Workshop ${flag.enabled ? "enabled" : "disabled"}`);
      utils.admin.features.list.invalidate();
      utils.user.workshops.isEnabled.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [createKey, setCreateKey] = useState(0);
  const [settingsTarget, setSettingsTarget] = useState<AdminWorkshopRow | null>(
    null,
  );
  const [settingsKey, setSettingsKey] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<AdminWorkshopRow | null>(
    null,
  );
  const displayDeleteTarget = useStickyValue(deleteTarget);

  const deleteMutation = trpc.admin.workshops.delete.useMutation({
    onSuccess: () => {
      toast.success("Workshop deleted");
      utils.admin.workshops.list.invalidate();
      utils.admin.modpacks.list.invalidate();
      setDeleteTarget(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const openCreate = () => {
    setCreateKey((key) => key + 1);
    setCreateOpen(true);
  };

  const openSettings = (workshop: AdminWorkshopRow) => {
    setSettingsKey((key) => key + 1);
    setSettingsTarget(workshop);
  };

  const workshops = workshopsQuery.data ?? [];

  const columns: DataTableColumn<AdminWorkshopRow>[] = [
    {
      key: "name",
      header: "Name",
      minWidth: 200,
      skeleton: () => <TwoLineCellSkeleton />,
      render: (workshop) => (
        <>
          <CellText value={workshop.name} className="font-medium" />
          <CellText
            value={`/${workshop.slug}`}
            className="text-xs text-muted-foreground"
          />
        </>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: 110,
      skeleton: () => <BadgeCellSkeleton />,
      render: (workshop) => (
        <Badge
          variant="outline"
          className={WORKSHOP_STATUS_STYLES[workshop.status]?.className}
        >
          {WORKSHOP_STATUS_STYLES[workshop.status]?.label ?? workshop.status}
        </Badge>
      ),
    },
    {
      key: "version",
      header: "Version",
      width: 95,
      cellClassName: "text-sm",
      render: (workshop) => workshop.gameVersion,
    },
    {
      key: "loader",
      header: "Loader",
      width: 100,
      cellClassName: "text-sm",
      render: (workshop) => loaderName(workshop.modLoaderType),
    },
    {
      key: "created",
      header: "Created",
      width: 120,
      render: (workshop) => <CellDate value={workshop.createdAt} />,
    },
  ];

  return (
    <div className="flex flex-1 flex-col gap-4">
      <AdminPageHeader
        trail={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Tools", href: "/admin/tools" },
          { label: "Workshop" },
        ]}
      />

      <div className="mx-auto w-full max-w-[1400px] flex flex-1 flex-col gap-4 px-4 pb-4">
        <AdminPageTitle
          title="Workshop"
          actions={
            <>
              <LabeledSwitch
                id="workshop-enabled"
                label="Feature Enabled"
                checked={workshopFlag?.enabled ?? false}
                disabled={
                  flagsQuery.isLoading ||
                  !!flagsQuery.error ||
                  setFlagMutation.isPending
                }
                onCheckedChange={(checked) =>
                  setFlagMutation.mutate({
                    name: "workshop",
                    enabled: checked,
                    description: "Workshop tab",
                  })
                }
              />
              <Button onClick={openCreate}>
                <Plus className="mr-2 size-4" />
                New Workshop
              </Button>
            </>
          }
        />

        <Card className="gap-0">
          <CardHeader className="gap-0 border-b">
            <CardTitle>
              Workshops ({workshops.length.toLocaleString()})
            </CardTitle>
          </CardHeader>

          {workshopsQuery.error ? (
            <CardContent className="flex flex-1 items-center justify-center py-12">
              <div className="text-center">
                <p className="text-destructive">
                  {workshopsQuery.error.message}
                </p>
                <Button
                  onClick={() => workshopsQuery.refetch()}
                  className="mt-4"
                  variant="outline"
                >
                  Try Again
                </Button>
              </div>
            </CardContent>
          ) : !workshopsQuery.isLoading && workshops.length === 0 ? (
            <CardContent className="flex flex-1 items-center justify-center py-12">
              <div className="text-center">
                <Hammer className="mx-auto size-12 text-muted-foreground" />
                <p className="mt-2 text-muted-foreground">No workshops yet</p>
                <Button onClick={openCreate} className="mt-4">
                  <Plus className="mr-2 size-4" />
                  Create First Workshop
                </Button>
              </div>
            </CardContent>
          ) : (
            <CardContent className="px-0">
              <DataTable
                columns={columns}
                rows={workshops}
                loading={workshopsQuery.isLoading}
                rowKey={(workshop) => workshop.id}
                onRowClick={(workshop) =>
                  navigate(`/admin/tools/workshop/${workshop.slug}`)
                }
                actions={(workshop) => [
                  {
                    label: "Edit",
                    icon: Pencil,
                    onClick: () => openSettings(workshop),
                  },
                  {
                    label:
                      workshop.status === "archived"
                        ? "Delete"
                        : "Only archived workshops can be deleted",
                    icon: Trash2,
                    variant: "destructive",
                    disabled: workshop.status !== "archived",
                    onClick: () => setDeleteTarget(workshop),
                  },
                ]}
                actionSlots={2}
              />
            </CardContent>
          )}
        </Card>

        <ModpacksCard />
      </div>

      <CreateWorkshopDialog
        key={createKey}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={<>Delete &quot;{displayDeleteTarget?.name}&quot;?</>}
        description="This permanently removes the workshop with its suggestions, votes, polls, and history. Mods it placed in the pack stay, but lose their suggestion credit and can no longer be reviewed. Discord discussion threads are left in place. This cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() =>
          deleteTarget
            ? deleteMutation.mutateAsync({ workshopId: deleteTarget.id })
            : undefined
        }
      />

      {settingsTarget && (
        <WorkshopSettingsDialog
          key={`settings-${settingsKey}`}
          open
          onOpenChange={(open) => {
            if (!open) setSettingsTarget(null);
          }}
          workshop={settingsTarget}
          hasMods={settingsTarget.modCount > 0}
        />
      )}
    </div>
  );
}
