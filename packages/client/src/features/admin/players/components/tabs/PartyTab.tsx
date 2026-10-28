import { Link } from "react-router";
import { ExternalLink, Users } from "lucide-react";
import { colorHex } from "@createrington/shared/team-tag";
import { Badge } from "@/components/ui/badge";
import { Loading } from "@/components/loading-spinner";
import { TeamTagPlate } from "@/components/team-tag-plate";
import { trpc } from "@/lib/trpc";
import { PartyMembersPanel } from "@/features/admin/tools/parties/components/PartyMembersPanel";
import { PartyRankBadge } from "@/features/admin/tools/parties/components/PartyRankBadge";

const SERVER_ID = 1;

const SECTION_LABEL =
  "text-xs font-semibold uppercase tracking-wider text-muted-foreground";

export function PartyTab({ playerUuid }: { playerUuid: string }) {
  const statusQuery = trpc.admin.parties.playerStatus.useQuery({
    serverId: SERVER_ID,
    playerUuid,
  });

  if (statusQuery.isLoading) {
    return <Loading size="small" />;
  }

  const party = statusQuery.data?.party ?? null;
  const allyOf = statusQuery.data?.allyOf ?? [];

  if (!party && allyOf.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12">
        <Users className="size-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          This player is not in a party.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {party && (
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <TeamTagPlate code={party.tagCode} zoom={3} />
            <span
              aria-hidden
              className="size-3 rounded-sm ring-1 ring-inset ring-white/10"
              style={{ backgroundColor: `#${colorHex(party.color)}` }}
            />
            <h3 className="text-lg font-semibold">{party.name}</h3>
            <PartyRankBadge rank={party.rank} />
            {party.freeToJoin && (
              <Badge
                variant="outline"
                className="border-green-500/20 bg-green-500/10 text-green-400"
              >
                Free to join
              </Badge>
            )}
            <Link
              to={`/admin/tools/parties?party=${party.id}`}
              className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Open in Parties
              <ExternalLink className="size-3" />
            </Link>
          </div>
          {party.description && (
            <p className="text-sm text-muted-foreground">{party.description}</p>
          )}
          <PartyMembersPanel partyId={party.id} />
        </section>
      )}

      {allyOf.length > 0 && (
        <section className="flex flex-col gap-2">
          <h4 className={SECTION_LABEL}>Ally of · {allyOf.length}</h4>
          <ul className="divide-y divide-border rounded-md border border-border bg-card">
            {allyOf.map((ally) => (
              <li key={ally.id} className="flex items-center gap-3 px-3 py-2">
                <TeamTagPlate code={ally.tagCode} />
                <span className="min-w-0 flex-1 truncate font-medium">
                  {ally.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {ally.memberCount} member{ally.memberCount === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
