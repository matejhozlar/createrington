import { defineApiSpec } from "@/scripts/api/spec-types";

export default defineApiSpec({
  name: "Allies",
  prefix: "/api/allies",
  description:
    "Ally state sync from the opac-fakeplayer mod (fake-player party + allied parties + qualified players)",
  auth: "Server IP + Mod JWT",
  mod: true,
  endpoints: [
    {
      method: "POST",
      path: "/sync",
      name: "AllySync",
      description:
        "Full state sync of the fake-player party, currently allied parties, and qualified/pending players. Replaces the entire ally state for the given serverId. Sent on change events and periodically as a heartbeat.",
      request: {
        name: "AllySyncRequest",
        fields: [
          { name: "serverId", type: "int", description: "Server identifier" },
          { name: "timestamp", type: "long", description: "Unix milliseconds" },
          {
            name: "fakePlayerParty",
            description:
              "Snapshot of the fake-player party managed by opac-fakeplayer",
            type: {
              type: "object",
              name: "FakePlayerPartyData",
              fields: [
                {
                  name: "partyId",
                  type: "string",
                  description: "OPAC party UUID",
                },
                {
                  name: "ownerUuid",
                  type: "string",
                  description: "UUID of the fake-player party owner",
                },
                {
                  name: "ownerName",
                  type: "string",
                  description: "Display name of the fake-player party owner",
                },
                {
                  name: "members",
                  type: {
                    type: "array",
                    items: {
                      type: "object",
                      name: "FakePlayerPartyMemberData",
                      fields: [
                        {
                          name: "uuid",
                          type: "string",
                          description: "Fake-player member UUID",
                        },
                      ],
                    },
                  },
                },
              ],
            },
          },
          {
            name: "allies",
            description:
              "Real-player parties currently allied with the fake-player party",
            type: {
              type: "array",
              items: {
                type: "object",
                name: "AlliedPartyData",
                fields: [
                  {
                    name: "partyId",
                    type: "string",
                    description: "OPAC party UUID",
                  },
                  {
                    name: "alliedAt",
                    type: "long",
                    description:
                      "Unix milliseconds when the alliance was formed",
                  },
                ],
              },
            },
          },
          {
            name: "qualified",
            description:
              "Players who have met the ally trigger requirements and are currently in an allied party",
            type: {
              type: "array",
              items: {
                type: "object",
                name: "QualifiedPlayerData",
                fields: [
                  {
                    name: "uuid",
                    type: "string",
                    description: "Minecraft player UUID",
                  },
                  {
                    name: "qualifiedAt",
                    type: "long",
                    description: "Unix milliseconds when the player qualified",
                  },
                ],
              },
            },
          },
          {
            name: "pending",
            description:
              "Players who have qualified but are not yet in any allied party",
            type: {
              type: "array",
              items: {
                type: "object",
                name: "PendingQualifiedPlayerData",
                fields: [
                  {
                    name: "uuid",
                    type: "string",
                    description: "Minecraft player UUID",
                  },
                  {
                    name: "qualifiedAt",
                    type: "long",
                    description: "Unix milliseconds when the player qualified",
                  },
                ],
              },
            },
          },
        ],
      },
      response: {
        name: "AllySyncResponse",
        fields: [{ name: "success", type: "boolean" }],
      },
    },
  ],
});
