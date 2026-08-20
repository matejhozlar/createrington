# Database Setup

The database runs in a Docker container using PostgreSQL 15. You need Docker installed — that's it.

## First time setup

```bash
pnpm db:up
pnpm db:migrate
pnpm db:seed
```

That's it. The database is ready to use.

## Available commands

| Command              | What it does                                                |
| -------------------- | ----------------------------------------------------------- |
| `pnpm db:up`         | Starts the database container                               |
| `pnpm db:down`       | Stops the container                                         |
| `pnpm db:reset`      | Wipes everything, runs migrations, and seeds test data      |
| `pnpm db:destroy`    | Removes the container, image, and volumes completely        |
| `pnpm db:seed`       | Populates the database with test data                       |
| `pnpm db:shell`      | Opens a psql shell inside the database                      |
| `pnpm db:logs`       | Shows container logs                                        |
| `pnpm db:generate`   | Generates a Drizzle migration from schema changes           |
| `pnpm db:migrate`    | Applies pending migrations to the running database          |
| `pnpm pgadmin`       | Starts the PgAdmin web interface (http://localhost:5050)    |

## Schema changes

The database schema is defined in TypeScript at `packages/server/src/db/schema.ts` using [Drizzle ORM](https://orm.drizzle.team/).

To add or modify tables:

1. Edit `packages/server/src/db/schema.ts`
2. Run `pnpm db:generate` — creates a migration SQL file in `packages/server/drizzle/`
3. Run `pnpm db:migrate` — applies it to your local database
4. Run `pnpm generate` — regenerates TypeScript types and query classes

## Day to day

If something feels off or you want a clean slate, just run:

```bash
pnpm db:reset
```

This drops everything, rebuilds the container, runs all migrations, and reseeds the test data.

## PgAdmin

If you prefer a GUI, run `pnpm pgadmin` and open http://localhost:5050 in your browser.

- **Email:** admin@createrington.com
- **Password:** admin

Then add a new server with these details:

- **Host:** createrington_db
- **Port:** 5432
- **Database:** createrington_db
- **Username:** postgres
- **Password:** postgres

## Claude readonly role

The Claude admin chat (the `claude-automation` service) queries the production and dev databases through a dedicated `claude_readonly` Postgres role. Two pieces, in two repos:

- **The role itself** is created once per cluster, as the `postgres` superuser, by `claude-automation/scripts/sync-readonly-role.sh --init`. This repo never creates it.
- **What the role may read** is defined here in `docker/db/claude-readonly-role.sql`: blanket `SELECT` on every table, then explicit `REVOKE`s for blocked tables and column-level grants for partially visible ones. Treat it as the allow-list to update whenever a sensitive table or column is added.

The deploy workflows apply that file through `docker/db/sync-readonly-grants.sh` right after every migration, in a single transaction, as the database owner (so `ALTER DEFAULT PRIVILEGES` covers tables that later migrations create). They also copy both files to `/opt/createrington/docker/db/` and `/opt/createrington-dev/docker/db/`, which is where the manual re-sync in `claude-automation` reads them from. A migration that drops and recreates a table loses that table's grants until the sync step runs, a window of seconds within the same deploy.

Local dev does not need any of this: the role does not exist in the Docker database, and the sync script exits without changes when the role is missing.

## Troubleshooting

**Port 5432 is already in use.** You likely have PostgreSQL installed locally on your machine. Either stop your local PostgreSQL service or switch the container to a different port.

**Connection refused after db:up.** The container might still be starting up. Wait a few seconds and try again. If it persists, check the logs with `pnpm db:logs`.

**db:seed fails with "relation does not exist".** The schema didn't initialize properly. Run `pnpm db:reset` to start fresh.
