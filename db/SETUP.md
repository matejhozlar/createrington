# Database Setup

The database runs in a Docker container using PostgreSQL 15. You need Docker installed — that's it.

## First time setup

```bash
pnpm db:up
pnpm db:seed
```

That's it. The database is ready to use.

## Available commands

| Command              | What it does                                             |
| -------------------- | -------------------------------------------------------- |
| `pnpm db:up`      | Starts the database container                            |
| `pnpm db:down`    | Stops the container                                      |
| `pnpm db:reset`   | Wipes everything and starts fresh with test data         |
| `pnpm db:destroy` | Removes the container, image, and volumes completely     |
| `pnpm db:seed`    | Populates the database with test data                    |
| `pnpm db:shell`   | Opens a psql shell inside the database                   |
| `pnpm db:logs`    | Shows container logs                                     |
| `pnpm pgadmin`    | Starts the PgAdmin web interface (http://localhost:5050) |

## Day to day

If something feels off or you want a clean slate, just run:

```bash
pnpm db:reset
```

This drops everything, rebuilds the container, and reseeds the test data.

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

## Troubleshooting

**Port 5432 is already in use.** You likely have PostgreSQL installed locally on your machine. Either stop your local PostgreSQL service or switch the container to a different port.

**Connection refused after db:up.** The container might still be starting up. Wait a few seconds and try again. If it persists, check the logs with `pnpm db:logs`.

**db:seed fails with "relation does not exist".** The schema didn't initialize properly. Run `pnpm db:reset` to start fresh.
