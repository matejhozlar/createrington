import { useState } from "react";
import { ArrowDown, ArrowUp, Package, Trash2 } from "lucide-react";
import type { LauncherPackSource } from "@createrington/shared/launcher";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { CellDate, CellText } from "@/components/cell-text";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  BadgeCellSkeleton,
  DataTable,
  type DataTableAction,
  type DataTableColumn,
} from "@/components/data-table";
import { useMutationToast } from "@/hooks/use-mutation-toast";
import { useStickyValue } from "@/hooks/use-sticky-value";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { AddLauncherPackDialog } from "./components/AddLauncherPackDialog";

type PackRow = RouterOutput["owner"]["launcherPacks"]["list"]["packs"][number];

const SOURCE_BADGES: Record<
  LauncherPackSource,
  { label: string; className: string }
> = {
  curseforge: {
    label: "CurseForge",
    className: "border-orange-500/20 bg-orange-500/10 text-orange-400",
  },
  sandbox: {
    label: "Sandbox",
    className: "border-sky-500/20 bg-sky-500/10 text-sky-400",
  },
};

const PAGE_COPY = {
  title: "Launcher packs",
  description:
    "The modpacks every launcher may install, in the order its list shows them. The slug is what an installed pack is stored under, so it never changes; hide a pack instead of removing it when launchers may still hold it.",
  empty: "No pack is offered yet. Offer a modpack to list it in the launcher.",
} as const;

const REMOVE_COPY = {
  title: (slug: string) => `Stop offering "${slug}"?`,
  description:
    "Launchers that installed this pack can no longer update or repair it, and the slug can be used again. Its modpack and releases are kept.",
  confirmLabel: "Remove",
} as const;

export function OwnerLauncherPacks() {
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<PackRow | null>(null);
  const shownRemoving = useStickyValue(removing);

  const utils = trpc.useUtils();
  const packsQuery = trpc.owner.launcherPacks.list.useQuery();
  const refresh = () => {
    void utils.owner.launcherPacks.list.invalidate();
    void utils.owner.launcherPacks.candidates.invalidate();
  };

  const enableMutation = trpc.owner.launcherPacks.setEnabled.useMutation(
    useMutationToast({
      success: (pack) =>
        `${pack.enabled ? "Enabled" : "Disabled"} "${pack.slug}" in the launcher`,
      onSuccess: refresh,
    }),
  );
  const reorderMutation = trpc.owner.launcherPacks.reorder.useMutation(
    useMutationToast({
      success: "Launcher packs reordered",
      onSuccess: refresh,
    }),
  );
  const removeMutation = trpc.owner.launcherPacks.remove.useMutation(
    useMutationToast({
      success: (pack) => `No longer offering "${pack.slug}"`,
      onSuccess: refresh,
    }),
  );

  const packs = packsQuery.data?.packs ?? [];
  const busy =
    enableMutation.isPending ||
    reorderMutation.isPending ||
    removeMutation.isPending;

  const move = (pack: PackRow, offset: -1 | 1) => {
    const ids = packs.map((row) => row.id);
    const from = ids.indexOf(pack.id);
    const to = from + offset;
    if (from < 0 || to < 0 || to >= ids.length) return;
    ids.splice(from, 1);
    ids.splice(to, 0, pack.id);
    reorderMutation.mutate({ ids });
  };

  const columns: DataTableColumn<PackRow>[] = [
    {
      key: "position",
      header: "#",
      width: 56,
      align: "right",
      cellClassName: "tabular-nums text-muted-foreground",
      render: (pack) => packs.indexOf(pack) + 1,
    },
    {
      key: "slug",
      header: "Slug",
      width: 260,
      render: (pack) => (
        <CellText value={pack.slug} className="font-mono text-sm" copy />
      ),
    },
    {
      key: "modpack",
      header: "Modpack",
      minWidth: 200,
      render: (pack) => (
        <div className="flex flex-col">
          <span className="text-sm">{pack.modpack.name}</span>
          <span className="font-mono text-xs text-muted-foreground">
            {pack.modpack.curseforgeProjectId === null
              ? "No CurseForge project"
              : `CurseForge #${pack.modpack.curseforgeProjectId}`}
          </span>
        </div>
      ),
    },
    {
      key: "source",
      header: "Releases from",
      width: 124,
      skeleton: () => <BadgeCellSkeleton />,
      render: (pack) => (
        <Badge
          variant="outline"
          className={SOURCE_BADGES[pack.source].className}
        >
          {SOURCE_BADGES[pack.source].label}
        </Badge>
      ),
    },
    {
      key: "latest",
      header: "Latest release",
      width: 124,
      render: (pack) => (
        <CellText
          value={pack.latestVersion ?? "None ready"}
          className={
            pack.latestVersion
              ? "font-mono text-sm"
              : "text-sm text-muted-foreground"
          }
        />
      ),
    },
    {
      key: "enabled",
      header: "Listed",
      width: 80,
      render: (pack) => (
        <Switch
          checked={pack.enabled}
          disabled={busy}
          aria-label={`${pack.enabled ? "Hide" : "Show"} "${pack.slug}" in the launcher`}
          onCheckedChange={(enabled) =>
            enableMutation.mutate({ id: pack.id, enabled })
          }
        />
      ),
    },
    {
      key: "added",
      header: "Added",
      width: 110,
      render: (pack) => <CellDate value={pack.createdAt} />,
    },
  ];

  const rowActions = (pack: PackRow): DataTableAction[] => {
    const index = packs.indexOf(pack);
    return [
      {
        label: "Move up",
        icon: ArrowUp,
        disabled: busy || index <= 0,
        onClick: () => move(pack, -1),
      },
      {
        label: "Move down",
        icon: ArrowDown,
        disabled: busy || index < 0 || index >= packs.length - 1,
        onClick: () => move(pack, 1),
      },
      {
        label: "Remove",
        icon: Trash2,
        variant: "destructive",
        disabled: busy,
        onClick: () => setRemoving(pack),
      },
    ];
  };

  return (
    <div className="flex flex-1 flex-col gap-4">
      <AdminPageHeader
        trail={[
          { label: "Home", href: "/" },
          { label: "Owner" },
          { label: PAGE_COPY.title },
        ]}
      />

      <div className="mx-auto w-full max-w-[1400px] flex flex-1 flex-col gap-4 px-4 pb-4">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <CardTitle>
                {PAGE_COPY.title}
                {!packsQuery.isLoading && ` (${packs.length})`}
              </CardTitle>
              <CardDescription>{PAGE_COPY.description}</CardDescription>
            </div>
            <Button onClick={() => setAdding(true)}>
              <Package className="mr-2 size-4" />
              Offer a modpack
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {packsQuery.isError ? (
              <p className="py-8 text-center text-destructive">
                Failed to load the launcher packs: {packsQuery.error.message}
              </p>
            ) : !packsQuery.isLoading && packs.length === 0 ? (
              <p className="px-6 py-8 text-center text-muted-foreground">
                {PAGE_COPY.empty}
              </p>
            ) : (
              <DataTable
                columns={columns}
                rows={packs}
                loading={packsQuery.isLoading}
                loadingRows={2}
                rowKey={(pack) => pack.id}
                actions={rowActions}
                actionSlots={2}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <AddLauncherPackDialog
        open={adding}
        onClose={() => setAdding(false)}
        onAdded={refresh}
      />

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) setRemoving(null);
        }}
        title={shownRemoving ? REMOVE_COPY.title(shownRemoving.slug) : ""}
        description={REMOVE_COPY.description}
        confirmLabel={REMOVE_COPY.confirmLabel}
        variant="destructive"
        onConfirm={async () => {
          if (removing) await removeMutation.mutateAsync({ id: removing.id });
        }}
      />
    </div>
  );
}
