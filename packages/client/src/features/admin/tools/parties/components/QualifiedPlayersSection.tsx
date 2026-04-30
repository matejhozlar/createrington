import { CheckCircle2, Hourglass } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlayerLabel } from "@/components/player-label";
import { formatRelativeDateSafe } from "@/features/admin/format";
import type { RouterOutput } from "@/lib/trpc";

type QualifiedPlayer =
  RouterOutput["admin"]["parties"]["qualifiedPlayers"][number];

export function QualifiedPlayersSection({
  players,
}: {
  players: QualifiedPlayer[];
}) {
  const active = players.filter((p) => !p.isPending);
  const pending = players.filter((p) => p.isPending);

  return (
    <Card className="gap-2">
      <CardHeader>
        <CardTitle className="text-base">Qualified players</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 lg:grid-cols-2">
          <PlayerColumn
            title="Active"
            description="In an allied party"
            icon={
              <CheckCircle2
                className="size-4 text-success"
                aria-hidden="true"
              />
            }
            players={active}
          />
          <PlayerColumn
            title="Pending"
            description="Qualified but not yet in any allied party"
            icon={
              <Hourglass className="size-4 text-amber-500" aria-hidden="true" />
            }
            players={pending}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function PlayerColumn({
  title,
  description,
  icon,
  players,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  players: QualifiedPlayer[];
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm font-semibold">{title}</span>
        <Badge variant="secondary" className="text-[10px]">
          {players.length}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
      {players.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
          No players.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {players.map((p) => (
            <div
              key={p.playerUuid}
              className="flex items-center justify-between rounded-md border border-border p-2"
            >
              <PlayerLabel
                uuid={p.playerUuid}
                name={p.minecraftUsername ?? p.playerUuid}
                linkable={Boolean(p.minecraftUsername)}
                size={20}
              />
              <span className="text-xs text-muted-foreground">
                {formatRelativeDateSafe(p.qualifiedAt)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
