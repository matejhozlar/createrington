import { defineApiSpec } from "@/scripts/api/spec-types";

export default defineApiSpec({
  name: "Chunks",
  prefix: "/api/chunks",
  description:
    "Claimed chunk sync from opac-teams mod. Stores all player-claimed chunks with party metadata and forceload/active state.",
  auth: "Server IP + Mod JWT",
  mod: true,
  endpoints: [
    {
      method: "POST",
      path: "/sync",
      name: "ChunkSync",
      description:
        "Full state sync of all claimed chunks. Uses mark-and-sweep upsert: inserts or updates each chunk by (server_id, dimension, x, z), then deletes any rows not touched in this sync.",
      request: {
        name: "ChunkSyncRequest",
        fields: [
          {
            name: "serverId",
            type: "int",
            description: "Server identifier",
          },
          {
            name: "timestamp",
            type: "long",
            description: "Unix milliseconds",
          },
          {
            name: "chunks",
            description:
              "All claimed chunks on the server. Each chunk has an owner UUID, optional party info, and forceload/active flags.",
            type: {
              type: "array",
              items: {
                type: "object",
                name: "ChunkSyncData",
                fields: [
                  {
                    name: "playerUuid",
                    type: "string",
                    description:
                      "Minecraft UUID of the chunk owner (may be EXPIRED_CLAIM_UUID or fake player UUID for non-real owners)",
                  },
                  {
                    name: "dimension",
                    type: "string",
                    description: 'e.g. "minecraft:overworld"',
                  },
                  {
                    name: "x",
                    type: "int",
                    description: "Chunk X coordinate",
                  },
                  {
                    name: "z",
                    type: "int",
                    description: "Chunk Z coordinate",
                  },
                  {
                    name: "partyId",
                    type: "string",
                    nullable: true,
                    description: "OPAC party UUID (null if solo player)",
                  },
                  {
                    name: "partyName",
                    type: "string",
                    nullable: true,
                    description: "Party display name (null if solo player)",
                  },
                  {
                    name: "partyOptedIn",
                    type: "boolean",
                    nullable: true,
                    description:
                      "Party forceload opt-in status (null if solo player)",
                  },
                  {
                    name: "forceloadable",
                    type: "boolean",
                    description:
                      "Whether the player has marked this chunk as forceloadable",
                  },
                  {
                    name: "active",
                    type: "boolean",
                    description:
                      "Whether the chunk is currently active/loaded in-game",
                  },
                ],
              },
            },
          },
        ],
      },
      response: {
        name: "ChunkSyncResponse",
        fields: [{ name: "success", type: "boolean" }],
      },
    },
  ],
});
