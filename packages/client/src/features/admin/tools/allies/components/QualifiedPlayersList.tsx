import { CheckCircle2, Hourglass } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatRelativeDate } from "@/features/admin/format";
import type { RouterOutput } from "@/lib/trpc";

type QualifiedPlayer =
  RouterOutput["admin"]["allies"]["qualifiedPlayers"][number];

export function QualifiedPlayersList({
  players,
}: {
  players: QualifiedPlayer[];
}) {
  const active = players.filter((p) => !p.isPending);
  const pending = players.filter((p) => p.isPending);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <PlayerSection
        title="Active"
        description="In an allied party"
        icon={
          <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
        }
        players={active}
      />
      <PlayerSection
        title="Pending"
        description="Qualified but not in any party yet"
        icon={
          <Hourglass className="size-4 text-amber-500" aria-hidden="true" />
        }
        players={pending}
      />
    </div>
  );
}

function PlayerSection({
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {title}
          <Badge variant="secondary" className="ml-auto text-[10px]">
            {players.length}
          </Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent>
        {players.length === 0 ? (
          <p className="text-sm text-muted-foreground">No players.</p>
        ) : (
          <div className="space-y-2">
            {players.map((p) => (
              <div
                key={p.playerUuid}
                className="flex items-center justify-between rounded-md border border-border p-2"
              >
                <div>
                  <p className="text-sm font-medium">
                    {p.minecraftUsername ?? p.playerUuid}
                  </p>
                  {p.minecraftUsername && (
                    <p className="font-mono text-[10px] text-muted-foreground">
                      {p.playerUuid}
                    </p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatRelativeDate(p.qualifiedAt.toString())}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
