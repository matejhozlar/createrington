import { Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatRelativeDate } from "@/features/admin/format";
import type { RouterOutput } from "@/lib/trpc";

type AlliedParty = RouterOutput["admin"]["allies"]["alliedParties"][number];

export function AlliedPartiesList({ parties }: { parties: AlliedParty[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="size-4 text-primary" />
          Allied parties
          <Badge variant="secondary" className="ml-auto text-[10px]">
            {parties.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {parties.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No real-player parties are currently allied with the fake-player
            party.
          </p>
        ) : (
          parties.map((party) => <PartyRow key={party.id} party={party} />)
        )}
      </CardContent>
    </Card>
  );
}

function PartyRow({ party }: { party: AlliedParty }) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="font-medium">{party.partyName ?? "Unknown party"}</p>
          <p className="font-mono text-xs text-muted-foreground">
            {party.partyId}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Allied {formatRelativeDate(party.alliedAt.toString())}
        </p>
      </div>
      {party.members.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {party.members.map((m) => (
            <Badge key={m.playerUuid} variant="outline" className="text-xs">
              {m.minecraftUsername ?? m.playerUuid}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
