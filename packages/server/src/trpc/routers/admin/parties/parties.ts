import { z } from "zod";
import { adminProcedure } from "@/trpc/trpc";
import { Q } from "@/db";
import { minecraftRcon } from "@/utils/rcon";
import { mcUuid } from "@/utils/zod-schemas";
import { trpcError } from "@/trpc/utils";

export const partyProcedures = {
  kpis: adminProcedure
    .meta({ description: "Aggregate party + ally KPIs for a server" })
    .input(z.object({ serverId: z.number().int() }))
    .query(async ({ input }) => {
      return Q.server.forceload.party.getKpis(input.serverId);
    }),

  list: adminProcedure
    .meta({
      description:
        "Unified list of forceload parties on a server, with ally status joined by stable party UUID",
    })
    .input(z.object({ serverId: z.number().int() }))
    .query(async ({ input }) => {
      return Q.server.forceload.party.getUnifiedList(input.serverId);
    }),

  members: adminProcedure
    .meta({
      description:
        "Members of a party (keyed by stable party UUID) with per-member solo forceload chunk stats",
    })
    .input(
      z.object({
        serverId: z.number().int(),
        partyUuid: mcUuid,
      }),
    )
    .query(async ({ input }) => {
      return Q.server.forceload.party.getMembersWithChunkStats(
        input.serverId,
        input.partyUuid,
      );
    }),

  partyChunks: adminProcedure
    .meta({ description: "Chunks for a party (keyed by stable party UUID)" })
    .input(
      z.object({
        serverId: z.number().int(),
        partyUuid: mcUuid,
      }),
    )
    .query(async ({ input }) => {
      return Q.server.forceload.chunk.getChunksByPartyUuid(
        input.serverId,
        input.partyUuid,
      );
    }),

  playerChunks: adminProcedure
    .meta({
      description: "Solo forceload chunks for a player (keyed by player UUID)",
    })
    .input(
      z.object({
        serverId: z.number().int(),
        playerUuid: mcUuid,
      }),
    )
    .query(async ({ input }) => {
      return Q.server.forceload.chunk.getChunksByPlayerUuid(
        input.serverId,
        input.playerUuid,
      );
    }),

  fakeParty: adminProcedure
    .meta({ description: "Fake-player party snapshot for a server" })
    .input(z.object({ serverId: z.number().int() }))
    .query(async ({ input }) => {
      return Q.server.ally.fake.party.getFakePartyWithMembers(input.serverId);
    }),

  playerStatus: adminProcedure
    .meta({ description: "Ally status for a single player on a server" })
    .input(
      z.object({
        serverId: z.number().int(),
        playerUuid: mcUuid,
      }),
    )
    .query(async ({ input }) => {
      const [qualification, partyAlliance] = await Promise.all([
        Q.server.ally.qualified.player.getStatusForPlayer(
          input.serverId,
          input.playerUuid,
        ),
        Q.server.ally.qualified.player.getPartyAlliance(
          input.serverId,
          input.playerUuid,
        ),
      ]);
      return { qualification, partyAlliance };
    }),

  partyDetails: adminProcedure
    .meta({
      description:
        "Aggregate chunk stats for a single party (chunks claimed, forceloads, active, opted-in)",
    })
    .input(
      z.object({
        serverId: z.number().int(),
        partyId: mcUuid,
      }),
    )
    .query(async ({ input }) => {
      return Q.server.chunk.getPartyDetailsByPartyId(
        input.serverId,
        input.partyId,
      );
    }),

  alliedParties: adminProcedure
    .meta({
      description:
        "Allied parties on a server, excluding the requesting party (for showing other allies)",
    })
    .input(
      z.object({
        serverId: z.number().int(),
        partyId: mcUuid,
      }),
    )
    .query(async ({ input }) => {
      return Q.server.ally.party.getAlliedPartiesForParty(
        input.serverId,
        input.partyId,
      );
    }),

  resync: adminProcedure
    .meta({
      description:
        "Dispatch /opac-fp sync over RCON to force an immediate forceload + ally resync",
    })
    .input(z.object({ serverId: z.number().int() }))
    .mutation(async ({ input }) => {
      try {
        const response = await minecraftRcon.send(
          input.serverId,
          "opac-fp sync",
        );
        return { dispatched: true, response };
      } catch (error) {
        throw trpcError.internal(
          error instanceof Error
            ? `Failed to dispatch sync: ${error.message}`
            : "Failed to dispatch sync",
        );
      }
    }),
};
