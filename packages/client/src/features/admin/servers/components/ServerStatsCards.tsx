import { Server, Users, Clock, Activity } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ServerStatsCardsProps {
  isOnline: boolean;
  playerCount: number;
  maxPlayers: number;
  totalHours: number;
  avgSessionSeconds: number;
}

export function ServerStatsCards({
  isOnline,
  playerCount,
  maxPlayers,
  totalHours,
  avgSessionSeconds,
}: ServerStatsCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Status */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <p
                className={cn(
                  "text-2xl font-semibold",
                  isOnline ? "text-green-500" : "text-muted-foreground",
                )}
              >
                {isOnline ? "Online" : "Offline"}
              </p>
            </div>
            <div
              className={cn(
                "flex size-12 items-center justify-center rounded-full",
                isOnline ? "bg-green-500/10" : "bg-muted-foreground/10",
              )}
            >
              <Server
                className={cn(
                  "size-6",
                  isOnline ? "text-green-500" : "text-muted-foreground",
                )}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Online Players */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Online Players</p>
              <p className="text-2xl font-semibold">
                {playerCount}{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  / {maxPlayers}
                </span>
              </p>
            </div>
            <div className="flex size-12 items-center justify-center rounded-full bg-chart-2/10">
              <Users className="size-6 text-chart-2" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Total Playtime */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Playtime</p>
              <p className="text-2xl font-semibold">
                {totalHours.toLocaleString()}h
              </p>
            </div>
            <div className="flex size-12 items-center justify-center rounded-full bg-chart-3/10">
              <Clock className="size-6 text-chart-3" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Avg Session */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Avg Session</p>
              <p className="text-2xl font-semibold">
                {Math.round(avgSessionSeconds / 60)}m
              </p>
            </div>
            <div className="flex size-12 items-center justify-center rounded-full bg-chart-4/10">
              <Activity className="size-6 text-chart-4" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
