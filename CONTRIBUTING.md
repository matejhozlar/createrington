# Contributing to Createrington

Thanks for working on Createrington. This guide covers how the repository is
organized, the conventions we follow, and the workflow from a fresh clone to a
merged pull request. For a feature/architecture overview, see the
[README](./README.md).

## Table of Contents

- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Repository Layout](#repository-layout)
- [Branching Strategy](#branching-strategy)
- [Development Workflow](#development-workflow)
- [Code Style](#code-style)
- [Database Changes](#database-changes)
- [API Conventions](#api-conventions)
- [Mod-Facing API (Spec Files)](#mod-facing-api-spec-files)
- [Commit Messages](#commit-messages)
- [Testing](#testing)
- [Pull Requests](#pull-requests)
- [Continuous Integration](#continuous-integration)
- [Shared Packages & Sibling Repos](#shared-packages--sibling-repos)
- [License](#license)

## Prerequisites

- **Node.js** 22+
- **pnpm** (pinned via the `packageManager` field in `package.json`; run
  `corepack enable` to use the correct version automatically)
- **Docker** (for the PostgreSQL container)
- A Discord application (bot token + OAuth credentials) and a Minecraft server
  with RCON enabled if you need to exercise those integrations

## Getting Started

```bash
git clone https://gitea.matejhoz.com/Createrington/app.git createrington
cd createrington
pnpm install

# Configure environment
cp .env.example .env   # then fill in section 1

# Database
pnpm db:up        # start PostgreSQL on port 5433
pnpm db:migrate   # apply migrations
pnpm db:seed      # load test data
pnpm generate     # generate DB types + query classes, then typecheck

# Run the full dev stack (server + client + type watcher)
pnpm dev
```

`.env.example` at the repository root documents every environment variable.
Filling in section 1 is enough to boot locally; sections 2 and 3 cover
production-only values and optional integrations. See the
[README quick start](./README.md#quick-start) for the short version.

## Repository Layout

This is a pnpm monorepo with four workspaces under `packages/`:

| Workspace            | Description                                                        |
| -------------------- | ------------------------------------------------------------------ |
| `packages/server`    | Express 5 + tRPC v11 backend, Discord bots, PostgreSQL (port 5001) |
| `packages/client`    | React 19 + Vite SPA (port 3000)                                    |
| `packages/shared`    | Zod schemas and shared TypeScript types (incl. generated DB types) |
| `packages/api-types` | Published tRPC contracts for first-party consumer apps             |

Other top-level directories: `docker/` (PostgreSQL and local Minecraft server
containers, migrations, seed data), `mod-api/` (generated Java API library),
and `scripts/` (build helpers).

## Branching Strategy

- **`main`** receives PRs only from `dev`. It deploys production
  (createrington.com).
- **`dev`** is the integration branch. All feature work merges here via PR. It
  deploys the dev site (dev.createrington.com).
- Always create a new branch off `dev`. Never commit directly to `dev` or
  `main`.
- Branch names follow `type/short-description`, e.g. `feat/embed-builder`,
  `fix/daily-reward`, `refactor/player-deletion`.

## Development Workflow

| Command                 | What it does                                          |
| ----------------------- | ----------------------------------------------------- |
| `pnpm dev`              | Server + client + tRPC type watcher concurrently      |
| `pnpm dev:server`       | Server only (port 5001)                               |
| `pnpm dev:client`       | Client only (port 3000)                               |
| `pnpm typecheck`        | Type-check all workspaces (builds server types first) |
| `pnpm lint`             | Lint all workspaces (`lint:server`, `lint:client`)    |
| `pnpm format`           | Format the repo with Prettier                         |
| `pnpm format:check`     | Verify formatting without writing                     |
| `pnpm test:unit`        | Run server unit tests                                 |
| `pnpm test:integration` | Run server integration tests (requires the DB)        |
| `pnpm generate`         | Regenerate DB types + query classes, then typecheck   |

Before opening a PR, make sure the same checks CI runs pass locally:
`pnpm format:check`, `pnpm lint`, `pnpm typecheck`, and `pnpm test:unit`.

## Code Style

Formatting is handled by **Prettier** and linting by **ESLint** (per-workspace
configs in `packages/*/eslint.config.js`). The Prettier config (`.prettierrc`)
uses: 2-space indent, double quotes, semicolons, trailing commas, 80-column
print width, and always-parenthesized arrow params.

A Husky `pre-commit` hook runs `lint-staged`, which auto-formats staged files
with Prettier. Do not bypass hooks (`--no-verify`); fix the underlying issue
instead.

### Conventions

- **Comments**: default to none. Add a comment only when the _why_ is
  non-obvious (a hidden constraint, a subtle invariant, a workaround). Do not
  explain _what_ the code does or leave historical/PR notes. Service and
  repository classes are the exception: give them a one-paragraph class header
  and a one-line note on each public method.
- **Logging (server)**: use the global `logger` (Winston). Never use
  `console.log` in server code; it is only acceptable in `src/scripts/`.
- **Client data**: extract static display data (labels, metrics, feature lists)
  into typed constants above the component; keep components to layout and
  rendering.

## Database Changes

The schema is defined in TypeScript with Drizzle (`packages/server/src/db/schema/`).
There are **no database functions or triggers**: all business logic lives in
application code. Table names follow a hierarchical prefix convention
(`player`, `player_balance`, `player_ban`, `discord_embed_preset`, etc.).

To add or change a table/enum:

1. Edit the schema under `packages/server/src/db/schema/`.
2. `pnpm db:generate` to create the migration SQL in `packages/server/drizzle/`.
3. `pnpm db:migrate` to apply it to the Docker database.
4. `pnpm generate` to regenerate TypeScript types
   (`packages/shared/src/db/`) and query classes
   (`packages/server/src/generated/db/`).
5. Add any seed/test data to `docker/db/data/test-data.sql`.

Important rules:

- **Generated files are not edited by hand.** Anything under
  `packages/shared/src/db/` or `packages/server/src/generated/db/` is produced by
  `pnpm generate`.
- **Raw SQL stays at the query layer.** Custom queries live in query classes
  under `packages/server/src/db/queries/`, never in services, routes, or
  repositories. The base query methods are documented in
  `packages/server/src/db/queries/base.queries.ts`.
- Three access patterns are available: `Q` (singleton query instances), `db`
  (`db.inTransaction(...)` for transactions), and `R` (repositories for complex
  business logic).

## API Conventions

The server exposes a type-safe tRPC API (and a thin layer of Express REST routes
for webhooks, OAuth, and uploads). tRPC procedures have three auth levels:
`publicProcedure`, `userProcedure`, and `adminProcedure`
(`packages/server/src/trpc/trpc.ts`).

Procedure naming:

- `list` for paginated/filtered collections (never `getAll`)
- `get` for single-item lookups
- `create` / `update` / `delete` for mutations
- Domain verbs (`ban`, `unban`, `adjust`, `claim`, etc.) are fine for
  specialized actions

The `AppRouter` type is exported via the `@createrington/server/trpc` package
export and imported type-only on the client, so the API stays end-to-end
type-safe.

## Mod-Facing API (Spec Files)

Endpoints consumed by the Minecraft mods (under `/api/currency`, `/api/presence`,
`/api/trains`) are documented via structured **spec files** next to each
controller (`*.api-spec.ts`). These specs drive both the generated Java client
library (`mod-api/`) and the API reference docs.

When adding or changing a mod-facing endpoint: update the spec file and bump the
version in `mod-api/gradle.properties`. CI handles generation and publishing.

## Commit Messages

Use Conventional-Commit style: `type(scope): description`.

- **Types**: `feat`, `fix`, `chore`, `refactor`
- **Scope**: the affected package (`server`, `client`, `shared`, ...). Omit the
  scope only when the change genuinely spans multiple packages.
- **Description**: lowercase, imperative mood, no trailing period.

Examples:

```
feat(server): add admin waitlist routes
fix(client): correct daily reward countdown
refactor(server): centralize player deletion into a single service
chore(server): dump schema
```

Do not hand-edit `CHANGELOG.md` or bump package versions; releases are
automated.

## Testing

Tests use **Vitest** and live in the server workspace
(`packages/server/src/tests/`).

- `pnpm test:unit` runs unit tests (no external dependencies).
- `pnpm test:integration` runs integration tests, which require a running
  database (`pnpm db:up` first; `pnpm db:reset` for a clean slate).
- `pnpm test` runs the server suite in watch mode.

Tests run serially (`fileParallelism: false`) with a 10s timeout. Only unit
tests run in CI, so verify integration tests locally when your change touches the
database or query layer.

For UI/frontend changes, run the app (`pnpm dev`) and verify the behavior in the
browser. Type-checking and tests confirm code correctness, not feature
correctness.

## Pull Requests

We use the Gitea CLI, `tea`, for issues and pull requests (not `gh`).

1. Branch off `dev`, make your change, and ensure local checks pass
   (`pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test:unit`).
2. Push your branch and open a PR **targeting `dev`**:

   ```bash
   tea pr create -t "feat(server): add player ban endpoint" -b dev -d "..."
   ```

3. Keep PRs focused: one logical change per branch and PR. Follow-up fixes get
   their own branch and PR rather than being bundled into an open one.
4. Write the PR description for the reviewer: what the change does and why. Do
   not include process meta-commentary.
5. To auto-close issues, repeat the keyword per issue (Gitea does not parse the
   chained `Closes #1, #2` form):

   ```
   Closes #1, Closes #2, Closes #3
   ```

When evaluating an issue before implementing it, validate the premise against the
actual code. Issues are often drafted from user reports and may contain wrong
diagnoses or stale references; flag a bad premise and propose the correct
approach rather than implementing a fix that does not hold up.

## Continuous Integration

CI runs on every pull request to `main` and `dev`
(`.gitea/workflows/ci.yml`). It must be green before merge. Jobs:

| Job         | Command                                     |
| ----------- | ------------------------------------------- |
| `format`    | `pnpm format:check`                         |
| `lint`      | `pnpm lint`                                 |
| `typecheck` | `pnpm generate:ci` then `pnpm typecheck`    |
| `build`     | `pnpm build:server` and `pnpm build:client` |
| `test-unit` | server unit tests                           |

Merges into `dev` and `main` trigger the dev and production deploy workflows
respectively.

## Shared Packages & Sibling Repos

Shared libraries (`@createrington/ui`, `@createrington/icons`,
`@createrington/logger`, `@createrington/balloon-shaper`) live in a separate
monorepo. Changes there go through Changesets:
`pnpm changeset` → `pnpm version-packages` → `pnpm release`. Do not hand-edit
versions or changelogs in those repos either.

## License

Createrington is proprietary software. All rights are reserved by the Author
(Matej Hozlar), and **no license is granted** to use, copy, modify, or
distribute the Software outside of explicit written authorization. See
[LICENSE](./LICENSE) for the full terms.

By contributing to this repository you agree that:

- You are authorized to contribute (you are the Author or have been granted
  explicit permission to access and work on the Software).
- Your contributions become part of the Software and are owned by and assigned
  to the Author, covered by the same proprietary license, with all rights
  reserved.
- You grant the Author all rights necessary to use, modify, sublicense, and
  distribute your contributions as part of the Software, without restriction or
  expectation of compensation.
- You will not copy, retain, redistribute, or reuse any part of the Software or
  your contributions to it outside of this project without the Author's prior
  written permission.

If you do not agree to these terms, do not contribute.
