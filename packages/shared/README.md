# @createrington/shared

Types and schemas shared between the server and the client.

| Path              | Contents                                                   |
| ----------------- | ---------------------------------------------------------- |
| `src/api/`        | Zod schemas and types for REST payloads (embeds, waitlist) |
| `src/auth/`       | Auth roles and token payload types                         |
| `src/socket/`     | Socket.io event enums, subscription types, and payloads    |
| `src/db/`         | Database entity types (generated, do not edit)             |
| `src/workshop.ts` | Workshop domain types                                      |

`src/db/` is generated from the Drizzle schema in
`packages/server/src/db/schema/`. Run `pnpm generate` from the repository root
after any schema change.

See the [root README](../../README.md) and
[CONTRIBUTING.md](../../CONTRIBUTING.md).
