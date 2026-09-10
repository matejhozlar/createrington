import { defineApiSpec } from "@/scripts/api/spec-types";

export default defineApiSpec({
  name: "Servers",
  prefix: "/api/servers",
  description:
    "Public Minecraft server status: online state, maintenance flag and player counts. Built for launcher and in-game menu integrations (e.g. FancyMenu), no authentication required",
  auth: "Public",
  mod: true,
  endpoints: [
    {
      method: "GET",
      path: "/status",
      name: "Status",
      description:
        "Returns the current status of every configured server. Pass `server` to narrow the list to a single server by slug (404 when the slug is unknown). Responses are cacheable for 10 seconds.",
      query: [
        {
          name: "server",
          type: "string",
          nullable: true,
          description: 'Server slug filter, e.g. "rails"',
        },
      ],
      response: {
        name: "ServerStatusResponse",
        fields: [
          {
            name: "servers",
            type: {
              type: "array",
              items: {
                type: "object",
                name: "ServerStatusEntry",
                fields: [
                  { name: "id", type: "int" },
                  { name: "slug", type: "string" },
                  { name: "name", type: "string" },
                  {
                    name: "status",
                    type: "string",
                    description: '"online", "offline" or "unknown"',
                  },
                  { name: "maintenance", type: "boolean" },
                  { name: "playerCount", type: "int" },
                  { name: "maxPlayers", type: "int" },
                ],
              },
            },
          },
          {
            name: "totalPlayers",
            type: "int",
            description: "Sum of playerCount across the returned servers",
          },
          {
            name: "checkedAt",
            type: "string",
            description: "ISO 8601 UTC string",
          },
        ],
      },
    },
  ],
});
