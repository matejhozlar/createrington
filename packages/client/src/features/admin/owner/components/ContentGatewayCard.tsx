import { formatDate } from "@createrington/shared/format";
import { ErrorState } from "@/components/query-states";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { LabeledSwitch } from "@/components/labeled-switch";
import { useMutationToast } from "@/hooks/use-mutation-toast";
import { formatClockTimeWithSeconds, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { trpc, type RouterOutput, queryClient } from "@/lib/trpc";
import { useMutation, useQuery } from "@tanstack/react-query";

type BudgetSnapshot = RouterOutput["owner"]["contentGateway"]["budget"]["get"];

type UpstreamBudget = BudgetSnapshot["curseforge"];

type BudgetDay = UpstreamBudget["days"][number];

type DayPool = BudgetDay["pools"][number];

type DayCount = Exclude<keyof DayPool, "consumer" | "pool">;

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
      `${formatNumber(budget.used)} / ${formatNumber(budget.limitPerMinute)}`,
  },
  {
    label: "Withheld",
    hint: "Refused this minute, budget spent or hold on",
    value: (budget) => formatNumber(budget.withheld),
    alert: (budget) => budget.withheld > 0,
  },
  {
    label: "Resets at",
    hint: "The count starts over every minute",
    value: (budget) => formatClockTimeWithSeconds(budget.resetsAt),
  },
  {
    label: "Hold",
    hint: "No call goes out until then after a 429",
    value: (budget) =>
      budget.heldUntil
        ? `Until ${formatClockTimeWithSeconds(budget.heldUntil)}`
        : "None",
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
          .map((pool) => `${poolLabel(pool)} ${formatNumber(pool.calls)}`)
          .join(" · ")}
      </span>
    ),
  },
];

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

export function ContentGatewayCard() {
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
                  formatNumber(value)
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
                  `${poolLabel(pool)} ${formatNumber(pool.used)}` +
                  (pool.withheld > 0
                    ? ` (${formatNumber(pool.withheld)} withheld)`
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
      {formatNumber(value)}
    </span>
  );
}
