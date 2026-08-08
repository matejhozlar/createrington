# @createrington/server

Express 5 + tRPC v11 backend for the Createrington platform, running on port 5001
in development. It is the hub between the Minecraft servers, the Discord guild,
and the web client.

```bash
pnpm dev:server        # from the repository root
pnpm typecheck:server
pnpm lint:server
pnpm test              # Vitest, watch mode
```

| Path             | Contents                                                         |
| ---------------- | ---------------------------------------------------------------- |
| `src/trpc/`      | tRPC routers, split by auth level and by consumer                |
| `src/app/`       | Express app, REST feature routes, middleware                     |
| `src/services/`  | Business logic behind the DI container (`services/container.ts`) |
| `src/db/`        | Drizzle schema and query classes                                 |
| `src/discord/`   | Bot clients, slash commands, interactions, events                |
| `src/generated/` | Generated query classes (do not edit)                            |
| `src/scripts/`   | One-off utilities and code generators                            |
| `drizzle/`       | Migration SQL                                                    |

Two Discord bot users run side by side: a main bot for slash commands, events,
and leaderboards, and a web bot for OAuth and background work. Real-time updates
go out over Socket.io. `AppRouter` is exported via the `./trpc` package export so
the client gets end-to-end types with no generated client.

See the [root README](../../README.md) and
[CONTRIBUTING.md](../../CONTRIBUTING.md) for setup, database workflow, and
conventions.
