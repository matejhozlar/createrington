import { Link } from "react-router-dom";
import { CheckCircle2, Hourglass, MinusCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { formatRelativeDate } from "@/features/admin/format";

const SERVER_ID = 1;

export function AllyStatusSection({ playerUuid }: { playerUuid: string }) {
  const statusQuery = trpc.admin.allies.playerStatus.useQuery({
    serverId: SERVER_ID,
    playerUuid,
  });

  if (statusQuery.isLoading || !statusQuery.data) return null;

  const { qualification, partyAlliance } = statusQuery.data;

  const state: "active" | "pending" | "not-qualified" = !qualification
    ? "not-qualified"
    : qualification.isPending
      ? "pending"
      : "active";

  const STATE_META = {
    active: {
      label: "Qualified",
      description: "Player has met the ally trigger requirements.",
      icon: CheckCircle2,
      iconClass: "text-success",
      badge: <Badge variant="default">Active</Badge>,
    },
    pending: {
      label: "Pending",
      description: "Qualified but not yet in any allied party.",
      icon: Hourglass,
      iconClass: "text-amber-500",
      badge: <Badge variant="secondary">Pending</Badge>,
    },
    "not-qualified": {
      label: "Not qualified",
      description: "Player has not met the ally trigger requirements.",
      icon: MinusCircle,
      iconClass: "text-muted-foreground",
      badge: null,
    },
  } as const;

  const meta = STATE_META[state];
  const Icon = meta.icon;

  return (
    <div>
      <h3 className="text-lg font-semibold">Ally Status</h3>
      <div className="mt-4 space-y-2">
        <div className="flex items-start justify-between rounded-lg border border-border p-4">
          <div className="flex items-start gap-3">
            <Icon className={`mt-0.5 size-5 ${meta.iconClass}`} />
            <div>
              <p className="font-medium">{meta.label}</p>
              <p className="text-xs text-muted-foreground">
                {meta.description}
              </p>
              {qualification && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Qualified{" "}
                  {formatRelativeDate(qualification.qualifiedAt.toString())}
                </p>
              )}
            </div>
          </div>
          {meta.badge}
        </div>

        {partyAlliance && (
          <Link
            to="/admin/tools/allies"
            className="block rounded-lg border border-border p-4 transition hover:bg-accent"
          >
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <p className="font-medium">
                  {partyAlliance.partyName ?? "Allied party"}
                </p>
                <p className="font-mono text-xs text-muted-foreground">
                  {partyAlliance.partyId}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Allied {formatRelativeDate(partyAlliance.alliedAt.toString())}
              </p>
            </div>
          </Link>
        )}
      </div>
    </div>
  );
}
