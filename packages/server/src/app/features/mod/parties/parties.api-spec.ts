import { defineApiSpec } from "@/scripts/api/spec-types";

export default defineApiSpec({
  name: "Parties",
  prefix: "/api/parties",
  description:
    "FTB Teams party and team tag snapshot sync from the Createrington core mod (party_sync feature)",
  auth: "Server IP + Mod JWT",
  mod: true,
  endpoints: [
    {
      method: "POST",
      path: "/sync",
      name: "PartySync",
      description:
        "Full snapshot of every FTB Teams party on the server. Parties are upserted by teamId, parties missing from the snapshot are removed, and each party's member and ally sets are replaced. Sent when the snapshot changed (at most once a minute) and as a periodic resend.",
      request: {
        name: "PartySyncRequest",
        fields: [
          {
            name: "serverId",
            type: "int",
            description:
              "Server identifier; must match the server derived from the caller IP",
          },
          {
            name: "parties",
            description: "Every party on the server; at most 2,000 entries",
            type: {
              type: "array",
              items: {
                type: "object",
                name: "PartyData",
                fields: [
                  {
                    name: "teamId",
                    type: "string",
                    description: "FTB Teams party UUID",
                  },
                  {
                    name: "name",
                    type: "string",
                    description: "Party display name; at most 255 characters",
                  },
                  {
                    name: "description",
                    type: "string",
                    description:
                      "FTB Teams description, empty string when unset; at most 1,000 characters",
                  },
                  {
                    name: "color",
                    type: "int",
                    description: "Party colour as a packed RGB int",
                  },
                  {
                    name: "freeToJoin",
                    type: "boolean",
                    description: "FTB Teams free-to-join flag",
                  },
                  {
                    name: "members",
                    description:
                      "Party members (invited players excluded); exactly one has rank owner. At most 200 entries.",
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
                          {
                            name: "rank",
                            type: "string",
                            description:
                              'FTB Teams rank: "owner", "officer" or "member"',
                          },
                          {
                            name: "claims",
                            type: "int",
                            nullable: true,
                            description:
                              "The player's OPAC claimed chunk count; null when OPAC is not installed",
                          },
                          {
                            name: "forceloads",
                            type: "int",
                            nullable: true,
                            description:
                              "The player's OPAC forceloaded chunk count; null when OPAC is not installed",
                          },
                        ],
                      },
                    },
                  },
                  {
                    name: "allies",
                    description:
                      "Minecraft UUIDs of players holding the FTB Teams ally rank; at most 200 entries",
                    type: { type: "array", items: "string" },
                  },
                  {
                    name: "tagCode",
                    type: "string",
                    nullable: true,
                    description:
                      "Team tag design code (CRP1:...), null when the party has no tag; at most 255 characters",
                  },
                ],
              },
            },
          },
        ],
      },
      response: {
        name: "PartySyncResponse",
        fields: [{ name: "success", type: "boolean" }],
      },
    },
  ],
});
