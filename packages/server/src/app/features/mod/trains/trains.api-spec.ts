import { defineApiSpec } from "@/scripts/api/spec-types";

export default defineApiSpec({
  name: "Trains",
  prefix: "/api/trains",
  description:
    "Train crash event reporting from the Create: Trains Minecraft mod",
  auth: "Server IP + Mod JWT",
  mod: true,
  enveloped: true,
  endpoints: [
    {
      method: "POST",
      path: "/crash",
      name: "Crash",
      description:
        "Receives train crash data and sends a notification embed to the Rails 'n Sails notifications channel.",
      request: {
        name: "CrashRequest",
        fields: [
          { name: "trainId", type: "string" },
          { name: "trainName", type: "string" },
          { name: "speed", type: "double", nullable: true },
          { name: "carriageCount", type: "int", nullable: true },
          {
            name: "position",
            nullable: true,
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
          {
            name: "timestamp",
            type: "long",
            nullable: true,
            description: "Unix milliseconds",
          },
          {
            name: "owner",
            type: "string",
            nullable: true,
            description: "Minecraft UUID of train owner",
          },
          {
            name: "driverUuid",
            type: "string",
            nullable: true,
            description: "Minecraft UUID of active driver",
          },
          {
            name: "passengers",
            nullable: true,
            type: {
              type: "array",
              items: {
                type: "object",
                name: "CrashPassenger",
                fields: [
                  { name: "uuid", type: "string" },
                  { name: "name", type: "string", nullable: true },
                  { name: "isDriver", type: "boolean" },
                ],
              },
            },
          },
          {
            name: "backwardsDriver",
            nullable: true,
            type: {
              type: "object",
              name: "BackwardsDriver",
              fields: [
                { name: "uuid", type: "string" },
                { name: "name", type: "string", nullable: true },
              ],
            },
          },
        ],
      },
    },
  ],
});
