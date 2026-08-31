import { defineApiSpec } from "@/scripts/api/spec-types";

export default defineApiSpec({
  name: "Presence",
  prefix: "/api/presence",
  description:
    "Minecraft player presence tracking: join/leave events and periodic heartbeats",
  auth: "Server IP + Mod JWT",
  mod: true,
  endpoints: [
    {
      method: "POST",
      path: "/",
      name: "Presence",
      description:
        "Records a player join or leave event from a Minecraft server.",
      request: {
        name: "PresenceRequest",
        fields: [
          { name: "minecraftUsername", type: "string" },
          {
            name: "uuid",
            type: "string",
            description: "Minecraft player UUID",
          },
          { name: "state", type: "string", description: '"joined" or "left"' },
          {
            name: "timestamp",
            type: "long",
            nullable: true,
            description: "Unix milliseconds; defaults to server time",
          },
          {
            name: "serverId",
            type: "int",
            nullable: true,
            description:
              "Optional; must match the server derived from the caller IP",
          },
          {
            name: "position",
            nullable: true,
            description: "Last known position (only used when state is 'left')",
            type: {
              type: "object",
              name: "Position",
              fields: [
                { name: "x", type: "double" },
                { name: "y", type: "double" },
                { name: "z", type: "double" },
              ],
            },
          },
          {
            name: "dimension",
            type: "string",
            nullable: true,
            description: 'e.g. "minecraft:overworld"',
          },
        ],
      },
      response: {
        name: "PresenceResponse",
        fields: [
          { name: "success", type: "boolean" },
          { name: "message", type: "string" },
          {
            name: "data",
            type: {
              type: "object",
              name: "PresenceData",
              fields: [
                { name: "minecraftUsername", type: "string" },
                { name: "uuid", type: "string" },
                { name: "state", type: "string" },
                { name: "serverId", type: "int" },
                {
                  name: "receivedAt",
                  type: "string",
                  description: "ISO 8601 UTC string",
                },
              ],
            },
          },
        ],
      },
    },
    {
      method: "POST",
      path: "/heartbeat",
      name: "Heartbeat",
      description:
        "Receives the full online player list from a server. Reconciles tracked sessions against reality to clean up stale sessions. Requires a server-level mod token; per-player tokens are rejected.",
      request: {
        name: "HeartbeatRequest",
        fields: [
          {
            name: "players",
            type: {
              type: "array",
              items: {
                type: "object",
                name: "HeartbeatPlayer",
                fields: [
                  {
                    name: "uuid",
                    type: "string",
                    description: "Minecraft player UUID",
                  },
                  { name: "username", type: "string" },
                ],
              },
            },
          },
          {
            name: "serverId",
            type: "int",
            nullable: true,
            description:
              "Optional; must match the server derived from the caller IP",
          },
          {
            name: "timestamp",
            type: "long",
            nullable: true,
            description: "Unix milliseconds",
          },
        ],
      },
      response: {
        name: "HeartbeatResponse",
        fields: [
          { name: "success", type: "boolean" },
          { name: "message", type: "string" },
          {
            name: "data",
            type: {
              type: "object",
              name: "HeartbeatData",
              fields: [
                { name: "serverId", type: "int" },
                { name: "playersReported", type: "int" },
                {
                  name: "receivedAt",
                  type: "string",
                  description: "ISO 8601 UTC string",
                },
              ],
            },
          },
        ],
      },
    },
  ],
});
