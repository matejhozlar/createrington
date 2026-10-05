import { useState } from "react";
import { Ban, Download, Rocket } from "lucide-react";
import { formatDate } from "@createrington/shared/format";
import type { LauncherReleaseStatus } from "@createrington/shared/launcher";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { CardError } from "@/features/admin/components/CardState";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { useStickyValue } from "@/hooks/use-sticky-value";
import { cn } from "@/lib/utils";
import { trpc, type RouterOutput } from "@/lib/trpc";

type ReleaseRow =
  RouterOutput["owner"]["launcherReleases"]["list"]["releases"][number];

type CallDay = RouterOutput["owner"]["curseforgeCalls"]["list"]["days"][number];

type CallCount = Exclude<keyof CallDay, "date">;

type PendingAction = { kind: "release" | "withdraw"; release: ReleaseRow };

const STATUS_BADGES: Record<
  LauncherReleaseStatus,
  { label: string; className: string }
> = {
  pending: {
    label: "Pending",
    className: "border-primary/20 bg-primary/10 text-primary",
  },
  released: {
    label: "Released",
    className: "border-green-500/20 bg-green-500/10 text-green-400",
  },
  withdrawn: {
    label: "Withdrawn",
    className: "border-red-500/20 bg-red-500/10 text-red-400",
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

const CDN_SWITCH = {
  id: "launcher-curseforge-cdn-enabled",
  label: "CurseForge CDN fallback",
} as const;

const CALL_WEEK_DAYS = 7;

const CALLS_UNAVAILABLE_MESSAGE =
  "The stored counts cannot be read right now. Calls are still being counted and show up here once the store is back.";

const CALLS_IN_MEMORY_NOTE =
  "The counts are not stored on this environment. This shows only the calls since the server last started.";

const CALL_SUMMARY: {
  label: string;
  hint: string;
  count: CallCount;
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
    count: "refused",
    alert: true,
  },
  {
    label: "Throttled",
    hint: "Answered 429 in the days below",
    count: "throttled",
    alert: true,
  },
];

const CALL_COLUMNS: DataTableColumn<CallDay>[] = [
  {
    key: "date",
    header: "Day (UTC)",
    minWidth: 130,
    render: (day) => formatDate(day.date),
  },
  {
    key: "calls",
    header: "Calls",
    width: 110,
    align: "right",
    render: (day) => <CallCountCell value={day.calls} />,
  },
  {
    key: "refused",
    header: "Refused",
    width: 110,
    align: "right",
    render: (day) => <CallCountCell value={day.refused} alert />,
  },
  {
    key: "throttled",
    header: "Throttled",
    width: 110,
    align: "right",
    render: (day) => <CallCountCell value={day.throttled} alert />,
  },
];

function formatCount(value: number): string {
  return value.toLocaleString("en-US");
}

function sumCalls(days: CallDay[], count: CallCount, limit?: number): number {
  return days.slice(0, limit).reduce((total, day) => total + day[count], 0);
}

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
      key: "withdrawn",
      header: "Withdrawn",
      width: 130,
      render: (release) => <CellDate value={release.withdrawnAt} />,
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
                : "Publishing is switched off on this environment."}
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

        <CurseforgeCard />
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

function CurseforgeCard() {
  const utils = trpc.useUtils();
  const callsQuery = trpc.owner.curseforgeCalls.list.useQuery();
  const cdnQuery = trpc.owner.curseforgeCdn.get.useQuery();

  const cdnMutation = trpc.owner.curseforgeCdn.update.useMutation(
    useMutationToast({
      success: (cdn) =>
        `${CDN_SWITCH.label} ${cdn.enabled ? "enabled" : "disabled"}`,
      onSuccess: () => utils.owner.curseforgeCdn.get.invalidate(),
    }),
  );

  const source = callsQuery.data?.source;
  const days = callsQuery.data?.days ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>CurseForge</CardTitle>
        <CardDescription className="max-sm:col-start-1">
          Requests this server sent to the CurseForge API with its key, per day.
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
      {callsQuery.isError ? (
        <CardError
          message={`Failed to load the CurseForge calls: ${callsQuery.error.message}`}
          onRetry={() => void callsQuery.refetch()}
        />
      ) : source === "unavailable" ? (
        <CardError
          message={CALLS_UNAVAILABLE_MESSAGE}
          onRetry={() => void callsQuery.refetch()}
        />
      ) : (
        <CardContent className="flex flex-col gap-4">
          {source === "memory" && (
            <p className="text-sm text-muted-foreground">
              {CALLS_IN_MEMORY_NOTE}
            </p>
          )}
          <dl className="m-0 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {CALL_SUMMARY.map(({ label, hint, count, days: limit, alert }) => {
              const value = sumCalls(days, count, limit);
              return (
                <div key={label} className="flex flex-col gap-1">
                  <dt className="text-sm text-muted-foreground">{label}</dt>
                  <dd
                    className={cn(
                      "m-0 text-2xl font-semibold leading-none",
                      alert && value > 0 && "text-destructive",
                    )}
                  >
                    {callsQuery.isLoading ? (
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
          <DataTable
            columns={CALL_COLUMNS}
            rows={days}
            loading={callsQuery.isLoading}
            loadingRows={CALL_WEEK_DAYS}
            rowKey={(day) => day.date}
          />
        </CardContent>
      )}
    </Card>
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
