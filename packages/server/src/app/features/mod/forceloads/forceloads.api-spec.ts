import { defineApiSpec, type ObjectFieldType } from "@/scripts/api/spec-types";

// Chunk record is shared between player and party payloads. Inlining avoids a
// cross-record reference in the spec system: the generator dedupes by name
// so only a single ChunkData.java is emitted.
const CHUNK_DATA: ObjectFieldType = {
  type: "object",
  name: "ChunkData",
  fields: [
    {
      name: "dimension",
      type: "string",
      description: 'e.g. "minecraft:overworld"',
    },
    { name: "x", type: "int", description: "Chunk X coordinate" },
    { name: "z", type: "int", description: "Chunk Z coordinate" },
    {
      name: "active",
      type: "boolean",
      description:
        "Whether the chunk is currently force-loaded in-game right now",
    },
  ],
};

export default defineApiSpec({
  name: "Forceloads",
  prefix: "/api/forceloads",
  description:
    "Minecraft chunk forceload and party data sync from opac-teams mod",
  auth: "Server IP + Mod JWT",
  mod: true,
  endpoints: [
    {
      method: "POST",
      path: "/sync",
      name: "ForceloadSync",
      description:
        "Full state sync of all forceloadable chunks. Replaces the entire forceload state for the given serverId. Sent on change events and periodically as a heartbeat.",
      request: {
        name: "ForceloadSyncRequest",
        fields: [
          {
            name: "serverId",
            type: "int",
            description:
              "Server identifier; must match the server derived from the caller IP",
          },
          {
            name: "timestamp",
            type: "long",
            description: "Unix milliseconds",
          },
          {
            name: "players",
            description:
              "Solo players (not in any party, or in a non-opted-in party). A player appears here OR in a party's members, never both.",
            type: {
              type: "array",
              items: {
                type: "object",
                name: "PlayerForceloadData",
                fields: [
                  {
                    name: "uuid",
                    type: "string",
                    description: "Minecraft player UUID",
                  },
                  {
                    name: "chunks",
                    type: { type: "array", items: CHUNK_DATA },
                  },
                ],
              },
            },
          },
          {
            name: "parties",
            description:
              "Parties that have opted in to shared forceloading. Chunks are active when any member is online.",
            type: {
              type: "array",
              items: {
                type: "object",
                name: "PartyForceloadData",
                fields: [
                  {
                    name: "partyId",
                    type: "string",
                    description: "OPAC party UUID",
                  },
                  {
                    name: "partyName",
                    type: "string",
                    description: "Party display name",
                  },
                  {
                    name: "memberCount",
                    type: "int",
                    description: "Total number of party members",
                  },
                  {
                    name: "optedIn",
                    type: "boolean",
                    description:
                      "Whether the party has opted in to shared forceloading (always true in this array)",
                  },
                  {
                    name: "members",
                    type: {
                      type: "array",
                      items: {
                        type: "object",
                        name: "PartyMemberData",
                        fields: [
                          {
                            name: "uuid",
                            type: "string",
                            description: "Minecraft player UUID",
                          },
                        ],
                      },
                    },
                  },
                  {
                    name: "chunks",
                    description:
                      "Pooled forceloadable chunks from all party members",
                    type: { type: "array", items: CHUNK_DATA },
                  },
                ],
              },
            },
          },
        ],
      },
      response: {
        name: "ForceloadSyncResponse",
        fields: [{ name: "success", type: "boolean" }],
      },
    },
  ],
});
