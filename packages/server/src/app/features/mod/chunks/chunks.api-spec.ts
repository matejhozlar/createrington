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
        "Full state sync of all claimed chunks. Grouped per player so party context (id, name, members, opt-in flag) is sent once per player rather than repeated on every chunk row. The server flattens this internally and applies a mark-and-sweep upsert keyed on (server_id, dimension, x, z).",
      request: {
        name: "ChunkSyncRequest",
        fields: [
          { name: "serverId", type: "int", description: "Server identifier" },
          {
            name: "timestamp",
            type: "long",
            description: "Unix milliseconds",
          },
          {
            name: "players",
            description:
              "All players with at least one claimed chunk, grouped by player. Players with no claims are omitted entirely.",
            type: {
              type: "array",
              items: {
                type: "object",
                name: "PlayerChunkData",
                fields: [
                  {
                    name: "playerUuid",
                    type: "string",
                    description: "Minecraft UUID of the chunk owner",
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
                    name: "partyMembers",
                    nullable: true,
                    description:
                      "UUIDs of OTHER party members (the player's own UUID is excluded). Null if solo. Informational only — the server does not currently consume this field.",
                    type: { type: "array", items: "string" },
                  },
                  {
                    name: "partyOptedIn",
                    type: "boolean",
                    nullable: true,
                    description:
                      "Party forceload opt-in status (null if solo player)",
                  },
                  {
                    name: "chunks",
                    description: "All claimed chunks for this player",
                    type: {
                      type: "array",
                      items: {
                        type: "object",
                        name: "PlayerChunkEntry",
                        fields: [
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
