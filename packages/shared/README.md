# @createrington/shared

Types and schemas shared between the server and the client.

| Path                                                        | Contents                                                   |
| ----------------------------------------------------------- | ---------------------------------------------------------- |
| `src/api/`                                                  | Zod schemas and types for REST payloads (embeds, messages) |
| `src/auth/`                                                 | Auth roles and token payload types                         |
| `src/socket/`                                               | Socket.io event enums, subscription types, and payloads    |
| `src/db/`                                                   | Database entity types (generated, do not edit)             |
| `src/format.ts`                                             | Date, playtime, duration and money formatters              |
| `src/workshop.ts`, `src/gallery.ts`, `src/launcher.ts`      | Domain constants and types for those features              |
| `src/party.ts`, `src/team-tag.ts`, `src/minecraft-stats.ts` | Party ranks, team tag design codes, Minecraft stat labels  |
| `src/player-prompt.ts`, `src/structure-pack.ts`             | Player prompt limits, structure pack import schema         |
| `src/admin-reason.ts`, `src/types.ts`                       | Admin, ban and strike reason limits, shared utility types  |

`src/db/` is generated from the Drizzle schema in
`packages/server/src/db/schema/`. Run `pnpm generate` from the repository root
after any schema change.

See the [root README](../../README.md) and
[CONTRIBUTING.md](../../CONTRIBUTING.md).
