import { Loading } from "@/components/loading-spinner";
import { PlayerLabel } from "@/components/player-label";
import { trpc } from "@/lib/trpc";
import { PartyRankBadge } from "./PartyRankBadge";

const SECTION_LABEL =
  "text-xs font-semibold uppercase tracking-wider text-muted-foreground";

export function PartyMembersPanel({ partyId }: { partyId: number }) {
  const query = trpc.admin.parties.members.useQuery({ partyId });

  if (query.isLoading) return <Loading size="small" />;

  const members = query.data?.members ?? [];
  const allies = query.data?.allies ?? [];

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <section className="flex flex-col gap-2">
        <h4 className={SECTION_LABEL}>Members · {members.length}</h4>
        <ul className="divide-y divide-border rounded-md border border-border bg-card">
          {members.map((member) => (
            <li
              key={member.minecraftUuid}
              className="flex items-center gap-3 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <PlayerLabel
                  uuid={member.minecraftUuid}
                  name={member.minecraftUsername ?? member.minecraftUuid}
                />
              </div>
              <PartyRankBadge rank={member.rank} />
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h4 className={SECTION_LABEL}>Allies · {allies.length}</h4>
        {allies.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No player holds the ally rank in this party.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border bg-card">
            {allies.map((ally) => (
              <li key={ally.minecraftUuid} className="px-3 py-2">
                <PlayerLabel
                  uuid={ally.minecraftUuid}
                  name={ally.minecraftUsername ?? ally.minecraftUuid}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
