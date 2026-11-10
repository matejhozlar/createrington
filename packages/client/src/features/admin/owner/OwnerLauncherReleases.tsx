import { useState } from "react";
import { Ban, Download, Rocket } from "lucide-react";
import { formatDate } from "@createrington/shared/format";
import {
  LAUNCHER_PLATFORMS,
  type LauncherPlatform,
  type LauncherReleaseStatus,
} from "@createrington/shared/launcher";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { ErrorState } from "@/components/query-states";
import {
  LAUNCHER_PLATFORM_DISPLAY,
  launcherPlatformLabel,
} from "@/features/admin/launcherPlatforms";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CellDate, CellText } from "@/components/cell-text";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  BadgeCellSkeleton,
  DataTable,
  type DataTableAction,
  type DataTableColumn,
} from "@/components/data-table";
import { LabeledSwitch } from "@/components/labeled-switch";
import { useMutationToast } from "@/hooks/use-mutation-toast";
import { cn } from "@/lib/utils";
import { trpc, type RouterOutput, queryClient } from "@/lib/trpc";
import { useQuery, useMutation } from "@tanstack/react-query";

type ReleaseRow =
  RouterOutput["owner"]["launcherReleases"]["list"]["releases"][number];

type BudgetSnapshot = RouterOutput["owner"]["contentGateway"]["budget"]["get"];

type UpstreamBudget = BudgetSnapshot["curseforge"];

type BudgetDay = UpstreamBudget["days"][number];

type DayPool = BudgetDay["pools"][number];

type DayCount = Exclude<keyof DayPool, "consumer" | "pool">;

type PendingAction = { kind: "release" | "withdraw"; release: ReleaseRow };

const STATUS_BADGES: Record<
  LauncherReleaseStatus,
  { label: string; tone: BadgeTone }
> = {
  pending: { label: "Pending", tone: "primary" },
  released: { label: "Released", tone: "success" },
  withdrawn: { label: "Withdrawn", tone: "danger" },
  pruned: { label: "File removed", tone: "neutral" },
};

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

const CDN_SWITCH = {
  id: "launcher-curseforge-cdn-enabled",
  label: "CurseForge CDN fallback",
} as const;

const UPSTREAMS: { key: "curseforge" | "modrinth"; label: string }[] = [
  { key: "curseforge", label: "CurseForge" },
  { key: "modrinth", label: "Modrinth" },
];

const CALL_WEEK_DAYS = 7;

const BUDGET_REFRESH_MS = 15_000;

const BUDGET_UNAVAILABLE_MESSAGE =
  "The gateway cannot read its stored counts right now. Calls are still being counted and show up here once its store is back.";

const BUDGET_IN_MEMORY_NOTE =
  "The gateway keeps its counts in memory on this environment. This shows only the calls since it last started.";

const CALL_SUMMARY: {
  label: string;
  hint: string;
  count: DayCount;
  days?: number;
  alert?: boolean;
}[] = [
  { label: "Today", hint: "Calls since midnight UTC", count: "calls", days: 1 },
  {
    label: "Last 7 days",
    hint: "Calls, today included",
    count: "calls",
    days: CALL_WEEK_DAYS,
  },
  {
    label: "Refused",
    hint: "Answered 403 in the days below",
    count: "forbidden",
    alert: true,
  },
  {
    label: "Throttled",
    hint: "Answered 429 in the days below",
    count: "throttled",
    alert: true,
  },
];

const MINUTE_SUMMARY: {
  label: string;
  hint: string;
  value: (budget: UpstreamBudget) => string;
  alert?: (budget: UpstreamBudget) => boolean;
}[] = [
  {
    label: "This minute",
    hint: "Calls let through, of the budget per minute over every process",
    value: (budget) =>
      `${formatCount(budget.used)} / ${formatCount(budget.limitPerMinute)}`,
  },
  {
    label: "Withheld",
    hint: "Refused this minute, budget spent or hold on",
    value: (budget) => formatCount(budget.withheld),
    alert: (budget) => budget.withheld > 0,
  },
  {
    label: "Resets at",
    hint: "The count starts over every minute",
    value: (budget) => formatTime(budget.resetsAt),
  },
  {
    label: "Hold",
    hint: "No call goes out until then after a 429",
    value: (budget) =>
      budget.heldUntil ? `Until ${formatTime(budget.heldUntil)}` : "None",
    alert: (budget) => Boolean(budget.heldUntil),
  },
];

const DAY_COLUMNS: DataTableColumn<BudgetDay>[] = [
  {
    key: "date",
    header: "Day (UTC)",
    minWidth: 130,
    render: (day) => formatDate(day.date),
  },
  {
    key: "calls",
    header: "Calls",
    width: 100,
    align: "right",
    render: (day) => <CallCountCell value={sumPools(day.pools, "calls")} />,
  },
  {
    key: "hits",
    header: "Cached",
    width: 100,
    align: "right",
    render: (day) => <CallCountCell value={sumPools(day.pools, "hits")} />,
  },
  {
    key: "withheld",
    header: "Withheld",
    width: 100,
    align: "right",
    render: (day) => (
      <CallCountCell value={sumPools(day.pools, "withheld")} alert />
    ),
  },
  {
    key: "forbidden",
    header: "Refused",
    width: 100,
    align: "right",
    render: (day) => (
      <CallCountCell value={sumPools(day.pools, "forbidden")} alert />
    ),
  },
  {
    key: "throttled",
    header: "Throttled",
    width: 100,
    align: "right",
    render: (day) => (
      <CallCountCell value={sumPools(day.pools, "throttled")} alert />
    ),
  },
  {
    key: "pools",
    header: "Calls by pool",
    minWidth: 220,
    render: (day) => (
      <span className="text-xs text-muted-foreground">
        {day.pools
          .map((pool) => `${poolLabel(pool)} ${formatCount(pool.calls)}`)
          .join(" · ")}
      </span>
    ),
  },
];

function formatCount(value: number): string {
  return value.toLocaleString("en-US");
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function poolLabel(pool: { consumer: string; pool: string }): string {
  return `${pool.consumer} / ${pool.pool}`;
}

function sumPools(pools: DayPool[], count: DayCount): number {
  return pools.reduce((total, pool) => total + pool[count], 0);
}

function utcDay(daysAgo: number): string {
  const day = new Date();
  day.setUTCDate(day.getUTCDate() - daysAgo);
  return day.toISOString().slice(0, 10);
}

function sumDays(days: BudgetDay[], count: DayCount, limit?: number): number {
  const since = limit === undefined ? null : utcDay(limit - 1);
  return days
    .filter((day) => since === null || day.date >= since)
    .reduce((total, day) => total + sumPools(day.pools, count), 0);
}

export function OwnerLauncherReleases() {
  const [action, setAction] = useState<PendingAction | null>(null);
  const [required, setRequired] = useState(false);
  const [platform, setPlatform] = useState<LauncherPlatform>(
    LAUNCHER_PLATFORMS[0],
  );

  const releasesQuery = useQuery(
    trpc.owner.launcherReleases.list.queryOptions(),
  );

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

  const releases = releasesQuery.data?.releases ?? [];
  const channel = releasesQuery.data?.channel;
  const enabled = releasesQuery.data?.enabled ?? true;
  const tabs = LAUNCHER_PLATFORMS.map((value) => ({
    value,
    ...LAUNCHER_PLATFORM_DISPLAY[value],
    rows: releases.filter((release) => release.platform === value),
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
                ? "A published version stays pending until you release it. Download a pending build to test it first."
                : "Publishing is switched off on this environment."}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {releasesQuery.isError ? (
              <p className="py-8 text-center text-destructive">
                Failed to load launcher releases: {releasesQuery.error.message}
              </p>
            ) : (
              <Tabs
                value={platform}
                onValueChange={(value) =>
                  setPlatform(value as LauncherPlatform)
                }
              >
                <TabsList className="mx-6">
                  {tabs.map(({ value, label, icon: Icon, rows }) => (
                    <TabsTrigger key={value} value={value}>
                      <Icon aria-hidden />
                      {label}
                      {!releasesQuery.isLoading && ` (${rows.length})`}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {tabs.map(({ value, label, rows }) => (
                  <TabsContent key={value} value={value}>
                    {!releasesQuery.isLoading && rows.length === 0 ? (
                      <p className="py-8 text-center text-muted-foreground">
                        No {label} version has been published yet.
                      </p>
                    ) : (
                      <DataTable
                        columns={columns}
                        rows={rows}
                        loading={releasesQuery.isLoading}
                        rowKey={(release) => release.id}
                        actions={rowActions}
                        actionSlots={2}
                      />
                    )}
                  </TabsContent>
                ))}
              </Tabs>
            )}
          </CardContent>
        </Card>

        <ContentGatewayCard />
      </div>

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
    </div>
  );
}

function ContentGatewayCard() {
  const budgetQuery = useQuery(
    trpc.owner.contentGateway.budget.get.queryOptions(undefined, {
      refetchInterval: BUDGET_REFRESH_MS,
    }),
  );
  const cdnQuery = useQuery(trpc.owner.curseforgeCdn.get.queryOptions());

  const cdnMutation = useMutation(
    trpc.owner.curseforgeCdn.update.mutationOptions(
      useMutationToast({
        success: (cdn) =>
          `${CDN_SWITCH.label} ${cdn.enabled ? "enabled" : "disabled"}`,
        onSuccess: () =>
          queryClient.invalidateQueries(
            trpc.owner.curseforgeCdn.get.pathFilter(),
          ),
      }),
    ),
  );

  const snapshot = budgetQuery.data;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Content gateway</CardTitle>
        <CardDescription className="max-sm:col-start-1">
          Calls every Createrington process makes on the CurseForge key and to
          Modrinth through the gateway, per day and this minute against the
          budget.
        </CardDescription>
        <CardAction className="max-sm:col-span-full max-sm:row-start-3 max-sm:mt-2 max-sm:justify-self-stretch">
          <LabeledSwitch
            id={CDN_SWITCH.id}
            label={CDN_SWITCH.label}
            checked={cdnQuery.data?.enabled ?? false}
            disabled={
              cdnQuery.isLoading || cdnQuery.isError || cdnMutation.isPending
            }
            onCheckedChange={(enabled) => cdnMutation.mutate({ enabled })}
          />
        </CardAction>
      </CardHeader>
      {budgetQuery.isError ? (
        <ErrorState
          message={`Failed to load the gateway's budget: ${budgetQuery.error.message}`}
          onRetry={() => void budgetQuery.refetch()}
        />
      ) : snapshot?.source === "unavailable" ? (
        <ErrorState
          message={BUDGET_UNAVAILABLE_MESSAGE}
          onRetry={() => void budgetQuery.refetch()}
        />
      ) : (
        <CardContent className="flex flex-col gap-4">
          {snapshot?.source === "memory" && (
            <p className="text-sm text-muted-foreground">
              {BUDGET_IN_MEMORY_NOTE}
            </p>
          )}
          <Tabs defaultValue={UPSTREAMS[0].key}>
            <TabsList>
              {UPSTREAMS.map(({ key, label }) => (
                <TabsTrigger key={key} value={key}>
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
            {UPSTREAMS.map(({ key }) => (
              <TabsContent
                key={key}
                value={key}
                className="flex flex-col gap-4"
              >
                <UpstreamBudgetPanel
                  budget={snapshot?.[key]}
                  loading={budgetQuery.isLoading}
                />
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      )}
    </Card>
  );
}

function UpstreamBudgetPanel({
  budget,
  loading,
}: {
  budget: UpstreamBudget | undefined;
  loading: boolean;
}) {
  const days = budget?.days ?? [];

  return (
    <>
      <dl className="m-0 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {CALL_SUMMARY.map(({ label, hint, count, days: limit, alert }) => {
          const value = sumDays(days, count, limit);
          return (
            <div key={label} className="flex flex-col gap-1">
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd
                className={cn(
                  "m-0 text-2xl font-semibold leading-none",
                  alert && value > 0 && "text-destructive",
                )}
              >
                {loading ? (
                  <Skeleton className="h-6 w-16" />
                ) : (
                  formatCount(value)
                )}
              </dd>
              <dd className="m-0 text-xs text-muted-foreground">{hint}</dd>
            </div>
          );
        })}
      </dl>
      <div className="flex flex-col gap-4 border-t pt-4">
        <h3 className="m-0 text-sm font-medium">This minute</h3>
        <dl className="m-0 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {MINUTE_SUMMARY.map(({ label, hint, value, alert }) => (
            <div key={label} className="flex flex-col gap-1">
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd
                className={cn(
                  "m-0 text-2xl font-semibold leading-none",
                  budget && alert?.(budget) && "text-destructive",
                )}
              >
                {budget ? value(budget) : <Skeleton className="h-6 w-16" />}
              </dd>
              <dd className="m-0 text-xs text-muted-foreground">{hint}</dd>
            </div>
          ))}
        </dl>
        {budget && budget.pools.length > 0 && (
          <p className="m-0 text-xs text-muted-foreground">
            {budget.pools
              .map(
                (pool) =>
                  `${poolLabel(pool)} ${formatCount(pool.used)}` +
                  (pool.withheld > 0
                    ? ` (${formatCount(pool.withheld)} withheld)`
                    : ""),
              )
              .join(" · ")}
          </p>
        )}
      </div>
      <DataTable
        columns={DAY_COLUMNS}
        rows={days}
        loading={loading}
        loadingRows={CALL_WEEK_DAYS}
        rowKey={(day) => day.date}
      />
    </>
  );
}

function CallCountCell({ value, alert }: { value: number; alert?: boolean }) {
  return (
    <span
      className={cn(
        "tabular-nums",
        alert && value > 0 && "font-medium text-destructive",
        value === 0 && "text-muted-foreground",
      )}
    >
      {formatCount(value)}
    </span>
  );
}
