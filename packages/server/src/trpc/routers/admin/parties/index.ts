import { z } from "zod";
import { Q } from "@/db";
import { adminProcedure, router } from "@/trpc/trpc";
import { id } from "@/trpc/utils";
import { mcUuid } from "@/utils/zod-schemas";

export const adminPartiesRouter = router({
  kpis: adminProcedure
    .meta({ description: "Party, player, chunk and tag totals of a server" })
    .input(z.object({ serverId: id() }))
    .query(({ input }) => Q.server.party.getKpis(input.serverId)),

  list: adminProcedure
    .meta({
      description:
        "Every party of a server with owner, member, ally and chunk counts and its team tag",
    })
    .input(z.object({ serverId: id() }))
    .query(({ input }) => Q.server.party.getOverview(input.serverId)),

  members: adminProcedure
    .meta({ description: "Members and allies of a party with player names" })
    .input(z.object({ partyId: id() }))
    .query(async ({ input }) => {
      const [members, allies] = await Promise.all([
        Q.server.party.member.getWithPlayers(input.partyId),
        Q.server.party.ally.getWithPlayers(input.partyId),
      ]);
      return { members, allies };
    }),

  playerStatus: adminProcedure
    .meta({
      description:
        "The party a player belongs to with their rank, and the parties they are an ally of",
    })
    .input(z.object({ serverId: id(), playerUuid: mcUuid }))
    .query(async ({ input }) => {
      const [memberOf, allyOf] = await Promise.all([
        Q.server.party.getOverview(input.serverId, {
          memberUuid: input.playerUuid,
        }),
        Q.server.party.getOverview(input.serverId, {
          allyUuid: input.playerUuid,
        }),
      ]);
      const party = memberOf[0] ?? null;
      const membership = party
        ? await Q.server.party.member.find({
            partyId: party.id,
            minecraftUuid: input.playerUuid,
          })
        : null;
      return {
        party: party && membership ? { ...party, rank: membership.rank } : null,
        allyOf,
      };
    }),
});
