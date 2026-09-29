import { useState } from "react";
import { Ban, Download, Rocket } from "lucide-react";
import type { LauncherReleaseStatus } from "@createrington/shared/launcher";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

type ReleaseRow =
  RouterOutput["owner"]["launcherReleases"]["list"]["releases"][number];

type PendingAction = { kind: "release" | "withdraw"; release: ReleaseRow };

const STATUS_BADGES: Record<
  LauncherReleaseStatus,
  { label: string; className: string }
> = {
  pending: {
    label: "Pending",
    className: "border-chart-2 bg-chart-2/10 text-chart-2",
  },
  released: {
    label: "Released",
    className: "border-success bg-success/10 text-success",
  },
  withdrawn: {
    label: "Withdrawn",
    className: "border-border bg-muted text-muted-foreground",
  },
};

const CHANNEL_LABELS = {
  staging: "Staging",
  production: "Production",
} as const;

const CONFIRM_COPY = {
  release: {
    title: (version: string) => `Release ${version}?`,
    description:
      "Installed launchers will be offered this version the next time they check for updates.",
    confirmLabel: "Release",
    variant: "default",
  },
  withdraw: {
    title: (version: string) => `Withdraw ${version}?`,
    description:
      "This version will no longer be offered. Launchers that already installed it keep it, and the version number cannot be used again.",
    confirmLabel: "Withdraw",
    variant: "destructive",
  },
} as const;

export function OwnerLauncherReleases() {
  const [action, setAction] = useState<PendingAction | null>(null);
  const display = useStickyValue(action);

  const utils = trpc.useUtils();
  const releasesQuery = trpc.owner.launcherReleases.list.useQuery();

  const refresh = () => void utils.owner.launcherReleases.list.invalidate();

  const releaseMutation = trpc.owner.launcherReleases.release.useMutation(
    useMutationToast({
      success: (release) => `Released ${release.version}`,
      onSuccess: refresh,
    }),
  );
  const withdrawMutation = trpc.owner.launcherReleases.withdraw.useMutation(
    useMutationToast({
      success: (release) => `Withdrew ${release.version}`,
      onSuccess: refresh,
    }),
  );

  const releases = releasesQuery.data?.releases ?? [];
  const channel = releasesQuery.data?.channel;
  const enabled = releasesQuery.data?.enabled ?? true;

  const columns: DataTableColumn<ReleaseRow>[] = [
    {
      key: "version",
      header: "Version",
      width: 120,
      render: (release) => (
        <CellText value={release.version} className="font-mono text-sm" />
      ),
    },
    {
      key: "status",
      header: "Status",
      width: 120,
      skeleton: () => <BadgeCellSkeleton />,
      render: (release) => (
        <Badge
          variant="outline"
          className={STATUS_BADGES[release.status].className}
        >
          {STATUS_BADGES[release.status].label}
        </Badge>
      ),
    },
    {
      key: "platform",
      header: "Platform",
      width: 150,
      cellClassName: "text-sm text-muted-foreground",
      render: (release) => <CellText value={release.platform} />,
    },
    {
      key: "published",
      header: "Published",
      width: 130,
      render: (release) => <CellDate value={release.createdAt} />,
    },
    {
      key: "released",
      header: "Released",
      width: 130,
      render: (release) => <CellDate value={release.releasedAt} />,
    },
    {
      key: "notes",
      header: "Notes",
      minWidth: 240,
      cellClassName: "text-sm text-muted-foreground",
      render: (release) => <CellText value={release.notes} />,
    },
  ];

  const rowActions = (release: ReleaseRow): DataTableAction[] => [
    {
      label: "Download installer",
      icon: Download,
      onClick: () => window.open(release.url, "_blank", "noopener,noreferrer"),
    },
    {
      label: "Release",
      icon: Rocket,
      disabled: release.status !== "pending",
      onClick: () => setAction({ kind: "release", release }),
    },
    {
      label: "Withdraw",
      icon: Ban,
      variant: "destructive",
      disabled: release.status === "withdrawn",
      onClick: () => setAction({ kind: "withdraw", release }),
    },
  ];

  const confirm = async () => {
    if (!action) return;
    const mutation =
      action.kind === "release" ? releaseMutation : withdrawMutation;
    await mutation.mutateAsync({ id: action.release.id });
  };

  const copy = display ? CONFIRM_COPY[display.kind] : null;

  return (
    <div className="flex flex-1 flex-col gap-4">
      <AdminPageHeader
        trail={[
          { label: "Home", href: "/" },
          { label: "Owner" },
          { label: "Launcher releases" },
        ]}
      />

      <div className="mx-auto w-full max-w-[1400px] flex flex-1 flex-col gap-4 px-4 pb-4">
        <Card>
          <CardHeader>
            <CardTitle>
              Launcher releases
              {channel && ` (${CHANNEL_LABELS[channel]})`}
            </CardTitle>
            <CardDescription>
              {enabled
                ? "A published version stays pending until you release it. Download a pending installer to test it first."
                : "Launcher releases are switched off on this environment."}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {releasesQuery.isError ? (
              <p className="py-8 text-center text-destructive">
                Failed to load launcher releases: {releasesQuery.error.message}
              </p>
            ) : !releasesQuery.isLoading && releases.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">
                No launcher version has been published yet.
              </p>
            ) : (
              <DataTable
                columns={columns}
                rows={releases}
                loading={releasesQuery.isLoading}
                rowKey={(release) => release.id}
                actions={rowActions}
                actionSlots={2}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={action !== null}
        onOpenChange={(open) => {
          if (!open) setAction(null);
        }}
        title={copy && display ? copy.title(display.release.version) : ""}
        description={copy?.description}
        confirmLabel={copy?.confirmLabel ?? ""}
        variant={copy?.variant}
        onConfirm={confirm}
      />
    </div>
  );
}
