import { useState } from "react";
import { Ban, Download, Rocket } from "lucide-react";
import {
  LAUNCHER_PLATFORMS,
  LAUNCHER_RELEASE_STATUSES,
  type LauncherPlatform,
  type LauncherReleaseStatus,
} from "@createrington/shared/launcher";
import { AdminPage } from "@/features/admin/components/AdminPage";
import { AdminPageTitle } from "@/features/admin/components/AdminPageTitle";
import { FilterBar } from "@/features/admin/components/FilterBar";
import { ContentGatewayCard } from "@/features/admin/owner/components/ContentGatewayCard";
import { EmptyState, ErrorState } from "@/components/query-states";
import {
  LAUNCHER_PLATFORM_DISPLAY,
  launcherPlatformLabel,
} from "@/features/admin/launcherPlatforms";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CellDate, CellText } from "@/components/cell-text";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  BadgeCellSkeleton,
  DataTable,
  type DataTableAction,
  type DataTableColumn,
} from "@/components/data-table";
import { Paginator } from "@/components/paginator";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useMutationToast } from "@/hooks/use-mutation-toast";
import { trpc, type RouterOutput, queryClient } from "@/lib/trpc";
import { useMutation } from "@tanstack/react-query";
import { usePagedQuery } from "@/hooks/use-paged-query";

type ReleaseRow =
  RouterOutput["owner"]["launcherReleases"]["list"]["items"][number];

type PendingAction = { kind: "release" | "withdraw"; release: ReleaseRow };

type StatusFilter = LauncherReleaseStatus | "all";

const PAGE_SIZE = 20;

const STATUS_BADGES: Record<
  LauncherReleaseStatus,
  { label: string; tone: BadgeTone }
> = {
  pending: { label: "Pending", tone: "primary" },
  released: { label: "Released", tone: "success" },
  withdrawn: { label: "Withdrawn", tone: "danger" },
  pruned: { label: "File removed", tone: "neutral" },
};

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  ...LAUNCHER_RELEASE_STATUSES.map((value) => ({
    value,
    label: STATUS_BADGES[value].label,
  })),
];

const LIST_COPY = {
  search: "Search by version...",
  empty: (platform: string) => `No ${platform} version has been published yet.`,
  noMatch: (platform: string) => `No ${platform} version matches the filters.`,
} as const;

const REQUIRED_BADGE = { label: "Required", tone: "warning" } as const;

const REQUIRED_CHECKBOX = {
  id: "launcher-release-required",
  label: "Required update",
  hint: "Older launchers cannot use the app until they update. Tick it when this version goes with a change that breaks them.",
} as const;

const CHANNEL_LABELS = {
  staging: "Staging",
  production: "Production",
} as const;

const CONFIRM_COPY = {
  release: {
    title: (version: string, platform: string) =>
      `Release ${version} for ${platform}?`,
    description:
      "Installed launchers will be offered this version the next time they check for updates.",
    confirmLabel: "Release",
    variant: "default",
  },
  withdraw: {
    title: (version: string, platform: string) =>
      `Withdraw ${version} for ${platform}?`,
    description:
      "This version will no longer be offered. Launchers that already installed it keep it, and the version number cannot be used again.",
    confirmLabel: "Withdraw",
    variant: "destructive",
  },
} as const;

export function OwnerLauncherReleases() {
  const [action, setAction] = useState<PendingAction | null>(null);
  const [required, setRequired] = useState(false);
  const [platform, setPlatform] = useState<LauncherPlatform>(
    LAUNCHER_PLATFORMS[0],
  );
  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const needle = useDebouncedValue(search).trim();

  const releases = usePagedQuery(
    {
      platform,
      status: status === "all" ? undefined : status,
      search: needle || undefined,
    },
    (input) => trpc.owner.launcherReleases.list.queryOptions(input),
    PAGE_SIZE,
  );
  const releasesQuery = releases.query;

  const refresh = () =>
    void queryClient.invalidateQueries(
      trpc.owner.launcherReleases.list.pathFilter(),
    );

  const releaseMutation = useMutation(
    trpc.owner.launcherReleases.release.mutationOptions(
      useMutationToast({
        success: (release) =>
          `Released ${release.version} for ${launcherPlatformLabel(release.platform)}${release.required ? " as required" : ""}`,
        onSuccess: refresh,
      }),
    ),
  );
  const withdrawMutation = useMutation(
    trpc.owner.launcherReleases.withdraw.mutationOptions(
      useMutationToast({
        success: (release) =>
          `Withdrew ${release.version} for ${launcherPlatformLabel(release.platform)}`,
        onSuccess: refresh,
      }),
    ),
  );

  const channel = releasesQuery.data?.channel;
  const enabled = releasesQuery.data?.enabled ?? true;
  const filtered = status !== "all" || needle !== "";
  const tabs = LAUNCHER_PLATFORMS.map((value) => ({
    value,
    ...LAUNCHER_PLATFORM_DISPLAY[value],
  }));

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
        <Badge tone={STATUS_BADGES[release.status].tone}>
          {STATUS_BADGES[release.status].label}
        </Badge>
      ),
    },
    {
      key: "required",
      header: "Update",
      width: 110,
      skeleton: () => <BadgeCellSkeleton />,
      render: (release) =>
        release.required &&
        release.status === "released" && (
          <Badge tone={REQUIRED_BADGE.tone}>{REQUIRED_BADGE.label}</Badge>
        ),
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
      key: "withdrawn",
      header: "Withdrawn",
      width: 130,
      render: (release) => <CellDate value={release.withdrawnAt} />,
    },
    {
      key: "removed",
      header: "Removed",
      width: 130,
      render: (release) => <CellDate value={release.prunedAt} />,
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
      label: "Download",
      icon: Download,
      disabled: release.status === "pruned",
      onClick: () => window.open(release.url, "_blank", "noopener,noreferrer"),
    },
    {
      label: "Release",
      icon: Rocket,
      disabled: release.status !== "pending",
      onClick: () => {
        setRequired(false);
        setAction({ kind: "release", release });
      },
    },
    {
      label: "Withdraw",
      icon: Ban,
      variant: "destructive",
      disabled: release.status === "withdrawn" || release.status === "pruned",
      onClick: () => setAction({ kind: "withdraw", release }),
    },
  ];

  const confirm = async () => {
    if (!action) return;
    if (action.kind === "release") {
      await releaseMutation.mutateAsync({ id: action.release.id, required });
    } else {
      await withdrawMutation.mutateAsync({ id: action.release.id });
    }
  };

  const copy = action ? CONFIRM_COPY[action.kind] : null;

  return (
    <AdminPage
      trail={[
        { label: "Home", href: "/" },
        { label: "Owner" },
        { label: "Launcher releases" },
      ]}
    >
      <AdminPageTitle title="Launcher releases" />
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        placeholder={LIST_COPY.search}
        activeCount={(search ? 1 : 0) + (status !== "all" ? 1 : 0)}
      >
        <Select
          value={status}
          onValueChange={(value) => setStatus(value as StatusFilter)}
        >
          <SelectTrigger className="min-w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map(({ value, label }) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterBar>

      <Card className="gap-0">
        <CardHeader className="pb-6">
          <CardTitle>
            Launcher releases
            {channel && ` (${CHANNEL_LABELS[channel]})`}
          </CardTitle>
          <CardDescription>
            {enabled
              ? "A published version stays pending until you release it. Download a pending build to test it first."
              : "Publishing is switched off on this environment."}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {releasesQuery.isError ? (
            <ErrorState
              message={`Failed to load launcher releases: ${releasesQuery.error.message}`}
              onRetry={releases.retry}
              compact
            />
          ) : (
            <Tabs
              value={platform}
              onValueChange={(value) => setPlatform(value as LauncherPlatform)}
            >
              <TabsList className="mx-6">
                {tabs.map(({ value, label, icon: Icon }) => (
                  <TabsTrigger key={value} value={value}>
                    <Icon aria-hidden />
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>
              <TabsContent value={platform}>
                {!releases.loading && releases.total === 0 ? (
                  <EmptyState
                    icon={Rocket}
                    message={(filtered ? LIST_COPY.noMatch : LIST_COPY.empty)(
                      launcherPlatformLabel(platform),
                    )}
                    className="py-8"
                  />
                ) : (
                  <DataTable
                    columns={columns}
                    rows={releases.rows}
                    loading={releases.loading}
                    loadingRows={releases.loadingRows}
                    rowKey={(release) => release.id}
                    actions={rowActions}
                    actionSlots={2}
                  />
                )}
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
        {releases.total > 0 && !releasesQuery.isError && (
          <CardFooter className="border-t">
            <Paginator
              page={releases.page}
              limit={releases.limit}
              total={releases.total}
              totalPages={releases.totalPages}
              onPageChange={releases.setPage}
              itemLabel="release"
              className="w-full"
            />
          </CardFooter>
        )}
      </Card>

      <ContentGatewayCard />

      <ConfirmDialog
        open={action !== null}
        onOpenChange={(open) => {
          if (!open) setAction(null);
        }}
        title={
          copy && action
            ? copy.title(
                action.release.version,
                launcherPlatformLabel(action.release.platform),
              )
            : ""
        }
        description={copy?.description}
        confirmLabel={copy?.confirmLabel ?? ""}
        variant={copy?.variant}
        onConfirm={confirm}
      >
        {action?.kind === "release" && (
          <div className="flex items-start gap-2">
            <Checkbox
              id={REQUIRED_CHECKBOX.id}
              className="mt-0.5"
              checked={required}
              onCheckedChange={(checked) => setRequired(checked === true)}
            />
            <div className="flex flex-col gap-1">
              <Label
                htmlFor={REQUIRED_CHECKBOX.id}
                className="cursor-pointer text-sm"
              >
                {REQUIRED_CHECKBOX.label}
              </Label>
              <p className="text-sm text-muted-foreground">
                {REQUIRED_CHECKBOX.hint}
              </p>
            </div>
          </div>
        )}
      </ConfirmDialog>
    </AdminPage>
  );
}
