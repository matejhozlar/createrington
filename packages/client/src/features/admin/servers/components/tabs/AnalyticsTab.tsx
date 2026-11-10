import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { ActivityChart } from "../charts/ActivityChart";
import { HeatmapChart } from "../charts/HeatmapChart";
import { useQuery } from "@tanstack/react-query";
import { LoadingState } from "@/components/query-states";

interface AnalyticsTabProps {
  serverId: number;
}

const TIME_RANGES = [
  { value: "7", label: "Last 7 days" },
  { value: "14", label: "Last 14 days" },
  { value: "30", label: "Last 30 days" },
  { value: "60", label: "Last 60 days" },
  { value: "90", label: "Last 90 days" },
];

export function AnalyticsTab({ serverId }: AnalyticsTabProps) {
  const [days, setDays] = useState(30);

  const activityQuery = useQuery(
    trpc.admin.servers.activity.queryOptions({
      serverId,
      days,
    }),
  );

  const heatmapQuery = useQuery(
    trpc.admin.servers.heatmap.queryOptions({
      serverId,
      days,
    }),
  );

  const activity = activityQuery.data?.activity ?? [];
  const summary = activityQuery.data?.summary;
  const heatmap = heatmapQuery.data?.heatmap ?? [];
  const activityLoading = activityQuery.isLoading;
  const heatmapLoading = heatmapQuery.isLoading;

  return (
    <div className="flex flex-col gap-6">
      {/* Time Range Selector */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Analytics</h3>
        <Select
          value={String(days)}
          onValueChange={(v) => setDays(parseInt(v, 10))}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIME_RANGES.map((range) => (
              <SelectItem key={range.value} value={range.value}>
                {range.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent>
              <CardDescription>Peak Daily Players</CardDescription>
              <CardTitle className="text-2xl">
                {summary.peakDailyPlayers}
              </CardTitle>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <CardDescription>Avg Daily Players</CardDescription>
              <CardTitle className="text-2xl">
                {summary.avgDailyPlayers}
              </CardTitle>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <CardDescription>Active Days</CardDescription>
              <CardTitle className="text-2xl">
                {summary.activeDays}{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  / {summary.totalDays}
                </span>
              </CardTitle>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Activity Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daily Activity</CardTitle>
          <CardDescription>
            Unique players and total hours per day
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activityLoading ? (
            <LoadingState text="Loading activity..." />
          ) : activity.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              No activity data for this period
            </p>
          ) : (
            <ActivityChart data={activity} />
          )}
        </CardContent>
      </Card>

      {/* Heatmap */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Activity Heatmap</CardTitle>
          <CardDescription>
            Player activity by day of week and hour
          </CardDescription>
        </CardHeader>
        <CardContent>
          {heatmapLoading ? (
            <LoadingState text="Loading heatmap..." />
          ) : heatmap.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              No heatmap data for this period
            </p>
          ) : (
            <HeatmapChart data={heatmap} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
