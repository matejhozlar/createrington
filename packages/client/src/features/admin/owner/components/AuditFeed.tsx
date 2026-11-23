import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { UserMinus, UserPlus, type LucideIcon } from "lucide-react";
import { formatRelativeDate } from "@/lib/format";
import type { AdminAuditEntry } from "@/features/admin/owner/types";

const ACTIONS: Record<
  "promote" | "demote",
  { label: string; icon: LucideIcon; tone: BadgeTone; iconClassName: string }
> = {
  promote: {
    label: "Promote",
    icon: UserPlus,
    tone: "success",
    iconClassName: "text-tone-success",
  },
  demote: {
    label: "Demote",
    icon: UserMinus,
    tone: "danger",
    iconClassName: "text-destructive",
  },
};

interface AuditFeedProps {
  entries: AdminAuditEntry[];
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
              const action =
                ACTIONS[
                  entry.actionType === "admin_promote" ? "promote" : "demote"
                ];
              const Icon = action.icon;
              return (
                <div
                  key={entry.id}
                  className="flex items-start gap-3 rounded-md border p-3"
                >
                  <Icon className={`mt-0.5 size-4 ${action.iconClassName}`} />
                  <div className="flex-1 text-sm">
                    <div className="flex items-center gap-2">
                      <Badge tone={action.tone}>{action.label}</Badge>
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
