# Local Minecraft server

A NeoForge 1.21.1 Minecraft server for local development, so game-server-dependent
backend logic can be tested without touching production. Built on
[`itzg/minecraft-server`](https://github.com/itzg/docker-minecraft-server).

> **Status:** the server boots with the dev mods auto-installed. Their backend
> config (base URL + shared `MOD_JWT_SECRET`) is wired up in a follow-up; until
> then the mods load but stay disconnected from the backend.

## Modpack

`mc/modpack/` holds the CurseForge modpack for local development:

- `createrington-development-<version>.zip` — import this directly into the
  CurseForge app (Create Custom Profile -> Import) to get the dev client.
- `manifest.json` / `modlist.html` — the extracted manifest, checked in so the
  mod set is reviewable and diffable in git.

The pack targets NeoForge 21.1.222 / MC 1.21.1 and currently includes CRNet,
Create, PresenceAPI, and Createrington Currency. Installing these mods on the
server (and wiring their backend config) is the deferred follow-up noted above.

## Usage

`mc:up` runs under Infisical so the CurseForge API key is available to
auto-download the mods. Run it the same way as the backend (e.g. logged into
the Infisical CLI):

```bash
pnpm mc:up        # start the server (downloads NeoForge + mods on first run)
pnpm mc:logs      # follow the server logs
pnpm mc:console   # open an interactive RCON console (e.g. type: list)
pnpm mc:cmd list  # run a single console command, e.g. pnpm mc:cmd "say hi"
pnpm mc:down      # stop and remove the container (world is kept)
pnpm mc:reset     # stop and delete the world/data for a fresh start
```

To manage the database and Minecraft server together:

```bash
pnpm docker:up     # start both the Postgres and Minecraft containers
pnpm docker:down   # stop both
pnpm docker:logs   # follow both sets of logs
pnpm docker:reset  # reset the database (migrate + seed) and the MC world
```

The server is reachable at `localhost:25565`. First boot takes a few minutes
while NeoForge and the server jar download.

## Persistence

World and server data live in `mc/data/` (bind-mounted into the container and
git-ignored), so they survive `pnpm mc:down` and container restarts. Use
`pnpm mc:reset` to wipe and regenerate from scratch.

## Configuration

All settings are environment variables read by `docker-compose.yml`, with safe
defaults (see `.env.example`). Secrets are injected via Infisical:

```bash
infisical run -- pnpm mc:up
```

| Variable              | Default     | Purpose                                    |
| --------------------- | ----------- | ------------------------------------------ |
| `MC_MEMORY`           | `4G`        | JVM heap allocated to the server           |
| `MC_NEOFORGE_VERSION` | `21.1.222`  | NeoForge build (matches the mods' target)  |
| `MC_RCON_PASSWORD`    | `dev-rcon`  | RCON password                              |
| `MC_RCON_PORT`        | `25575`     | Host port mapped to the container's RCON   |
| `MC_ONLINE_MODE`      | `TRUE`      | Online auth (mirrors prod); `FALSE` to skip |

To let the backend's file operations (maintenance mode, whitelist resync) target
this server locally, set `MC_SERVER_LOCAL_PATH=./mc/data` in your root `.env`.
