import { Bot } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatRelativeDate } from "@/features/admin/format";
import type { RouterOutput } from "@/lib/trpc";

type FakeParty = RouterOutput["admin"]["allies"]["fakeParty"];

export function FakePartyCard({ data }: { data: FakeParty | null }) {
  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="size-4 text-muted-foreground" />
            Fake-player party
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No fake-player party has been synced yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bot className="size-4 text-primary" />
          Fake-player party
          <Badge variant="secondary" className="ml-auto text-[10px]">
            synced {formatRelativeDate(data.syncedAt.toString())}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Owner
            </p>
            <p className="font-medium">{data.ownerName}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Party UUID
            </p>
            <p className="font-mono text-xs">{data.partyId}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Members
            </p>
            <p className="font-medium">{data.members.length}</p>
          </div>
        </div>

        {data.members.length > 0 && (
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
              Member list
            </p>
            <div className="flex flex-wrap gap-2">
              {data.members.map((m) => (
                <Badge
                  key={m.playerUuid}
                  variant="outline"
                  className="font-mono text-xs"
                >
                  {m.minecraftUsername ?? m.playerUuid}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
