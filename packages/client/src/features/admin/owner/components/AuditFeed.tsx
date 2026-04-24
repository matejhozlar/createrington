import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserMinus, UserPlus } from "lucide-react";
import { formatRelativeDate } from "@/features/admin/format";

interface AuditEntry {
  id: number;
  actorDiscordId: string;
  actorUsername: string;
  actionType: string;
  description: string | null;
  targetPlayerName: string | null;
  reason: string | null;
  performedAt: string | null;
}

interface AuditFeedProps {
  entries: AuditEntry[];
  isLoading: boolean;
}

export function AuditFeed({ entries, isLoading }: AuditFeedProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent admin changes</CardTitle>
        <CardDescription>
          Last 20 promote/demote actions from the audit log.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="py-4 text-sm text-muted-foreground">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">No entries yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {entries.map((entry) => {
              const isPromote = entry.actionType === "admin_promote";
              const Icon = isPromote ? UserPlus : UserMinus;
              return (
                <div
                  key={entry.id}
                  className="flex items-start gap-3 rounded-md border p-3"
                >
                  <Icon
                    className={`mt-0.5 size-4 ${
                      isPromote ? "text-green-500" : "text-destructive"
                    }`}
                  />
                  <div className="flex-1 text-sm">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={isPromote ? "default" : "destructive"}
                        className="text-xs"
                      >
                        {isPromote ? "Promote" : "Demote"}
                      </Badge>
                      <span className="font-medium">
                        {entry.targetPlayerName ?? "unknown"}
                      </span>
                      <span className="text-muted-foreground">by</span>
                      <span className="font-medium">{entry.actorUsername}</span>
                    </div>
                    {entry.reason && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        &ldquo;{entry.reason}&rdquo;
                      </p>
                    )}
                  </div>
                  {entry.performedAt && (
                    <span className="text-xs text-muted-foreground">
                      {formatRelativeDate(entry.performedAt)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
